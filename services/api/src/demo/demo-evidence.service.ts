import { Injectable } from '@nestjs/common';
import {
  DisruptionAssessmentRequest,
  disruptionAssessmentRequestSchema,
} from '../integrations/ai/disruption-assessment.client';
import {
  Disruption,
  JsonValue,
  ProviderTimestamp,
} from '../disruption/model/disruption.model';
import { ShipmentView } from '../logistics/model/shipment-view.model';
import { DemoVehicleState } from './model/demo-vehicle-state.model';
import {
  DemoRoute,
  LuebeckHamburgRouteService,
} from './route/luebeck-hamburg-route.service';

export const WARNING_ROUTE_TOLERANCE_METRES = 25;

type Position = readonly [number, number];
type Point = { x: number; y: number };

interface RouteProjection {
  routeDistanceMetres: number;
  distanceToRouteMetres: number;
}

export interface DemoAssessmentEvidence {
  request: DisruptionAssessmentRequest;
  excluded: boolean;
  exclusionReasons: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function position(value: unknown): Position | undefined {
  if (!Array.isArray(value) || value.length !== 2) {
    return undefined;
  }
  const coordinates = value as [unknown, unknown];
  const [longitude, latitude] = coordinates;
  if (
    typeof longitude !== 'number' ||
    typeof latitude !== 'number' ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude)
  ) {
    return undefined;
  }
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    return undefined;
  }
  return [longitude, latitude];
}

function warningLineString(warning: Disruption): Position[] | undefined {
  if (!isRecord(warning.geometry) || warning.geometry.type !== 'LineString') {
    return undefined;
  }
  const coordinates = warning.geometry.coordinates;
  if (!Array.isArray(coordinates)) {
    return undefined;
  }
  const parsed = coordinates.map(position);
  return parsed.length >= 2 && parsed.every((item) => item)
    ? (parsed as Position[])
    : undefined;
}

function referenceLatitude(positions: readonly Position[]): number {
  return positions.reduce((sum, item) => sum + item[1], 0) / positions.length;
}

function toPoint(value: Position, latitude: number): Point {
  const metresPerDegreeLatitude = 111_132;
  const metresPerDegreeLongitude =
    111_320 * Math.cos((latitude * Math.PI) / 180);
  return {
    x: value[0] * metresPerDegreeLongitude,
    y: value[1] * metresPerDegreeLatitude,
  };
}

function distance(first: Point, second: Point): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function projectOntoSegment(
  point: Point,
  first: Point,
  second: Point,
): { distance: number; fraction: number } {
  const deltaX = second.x - first.x;
  const deltaY = second.y - first.y;
  const lengthSquared = deltaX ** 2 + deltaY ** 2;
  if (lengthSquared === 0) {
    return { distance: distance(point, first), fraction: 0 };
  }
  const fraction = Math.max(
    0,
    Math.min(
      1,
      ((point.x - first.x) * deltaX + (point.y - first.y) * deltaY) /
        lengthSquared,
    ),
  );
  return {
    distance: Math.hypot(
      point.x - (first.x + fraction * deltaX),
      point.y - (first.y + fraction * deltaY),
    ),
    fraction,
  };
}

function sampleLineString(points: readonly Point[]): Point[] {
  const samples: Point[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const first = points[index];
    const second = points[index + 1];
    const segments = Math.max(
      1,
      Math.ceil(distance(first, second) / WARNING_ROUTE_TOLERANCE_METRES),
    );
    for (let step = 0; step < segments; step += 1) {
      const fraction = step / segments;
      samples.push({
        x: first.x + (second.x - first.x) * fraction,
        y: first.y + (second.y - first.y) * fraction,
      });
    }
  }
  samples.push(points.at(-1)!);
  return samples;
}

function routePoints(
  route: DemoRoute,
  latitude = referenceLatitude(route.coordinates),
): { points: Point[]; lengths: number[]; total: number } {
  const points = route.coordinates.map((item) => toPoint(item, latitude));
  const lengths = points
    .slice(1)
    .map((item, index) => distance(points[index], item));
  return {
    points,
    lengths,
    total: lengths.reduce((sum, item) => sum + item, 0),
  };
}

function projectOntoRoute(
  point: Point,
  route: ReturnType<typeof routePoints>,
): RouteProjection {
  let closest: RouteProjection | undefined;
  let traversed = 0;
  for (let index = 0; index < route.lengths.length; index += 1) {
    const projected = projectOntoSegment(
      point,
      route.points[index],
      route.points[index + 1],
    );
    const candidate = {
      routeDistanceMetres:
        traversed + route.lengths[index] * projected.fraction,
      distanceToRouteMetres: projected.distance,
    };
    if (
      !closest ||
      candidate.distanceToRouteMetres < closest.distanceToRouteMetres
    ) {
      closest = candidate;
    }
    traversed += route.lengths[index];
  }
  return (
    closest ?? {
      routeDistanceMetres: 0,
      distanceToRouteMetres: Number.POSITIVE_INFINITY,
    }
  );
}

function toContractTimestamp(timestamp: ProviderTimestamp) {
  if (timestamp.kind === 'value') {
    return { kind: 'value' as const, value: timestamp.value.toISOString() };
  }
  return { kind: timestamp.kind };
}

function strings(values: readonly JsonValue[]): string[] {
  return values.filter((value): value is string => typeof value === 'string');
}

function directionState(shipment: ShipmentView, warning: Disruption) {
  const direction = warning.subtitle?.trim().toLowerCase();
  if (!direction || !direction.includes('->')) {
    return 'UNKNOWN' as const;
  }
  const [from, to] = direction.split('->').map((part) => part.trim());
  const pickup = shipment.pickupLocation.city.toLowerCase();
  const destination = shipment.destination.city.toLowerCase();
  if (from === pickup && to === destination) {
    return 'COMPATIBLE' as const;
  }
  if (from === destination && to === pickup) {
    return 'CONFLICTING' as const;
  }
  return 'UNKNOWN' as const;
}

function timingState(
  shipment: ShipmentView,
  vehicle: DemoVehicleState,
  warning: Disruption,
) {
  if (warning.startTimestamp.kind !== 'value') {
    return 'UNKNOWN' as const;
  }
  const start = warning.startTimestamp.value;
  const end =
    warning.endTimestamp.kind === 'value'
      ? warning.endTimestamp.value
      : undefined;
  if (
    start > shipment.plannedDeliveryAt ||
    (end && end < vehicle.simulatedAt)
  ) {
    return 'CONFLICTING' as const;
  }
  return 'POSSIBLE' as const;
}

function limitations(warning: Disruption) {
  const values = [
    {
      id: 'limitation-replay-provenance',
      description:
        'This is recorded REPLAY evidence, not a current traffic observation.',
    },
    {
      id: 'limitation-simulated-vehicle',
      description:
        'The vehicle location and clock are fictional demonstration data.',
    },
    {
      id: 'limitation-route-provenance',
      description:
        'The route is a later-captured passenger-car export and does not establish historical HGV suitability.',
    },
    {
      id: 'limitation-carriageway',
      description:
        'Warning geometry and text do not establish the affected carriageway.',
    },
  ];
  if (warning.endTimestamp.kind !== 'value') {
    values.push({
      id: 'limitation-missing-end-timestamp',
      description:
        'The provider did not supply an end timestamp for the warning.',
    });
  }
  return values;
}

@Injectable()
export class DemoEvidenceService {
  constructor(private readonly routeService: LuebeckHamburgRouteService) {}

  prepare(
    shipment: ShipmentView,
    vehicle: DemoVehicleState,
    warning: Disruption,
    assessmentId: string,
  ): DemoAssessmentEvidence {
    const route = this.routeService.getRoute();
    const warningGeometry = warningLineString(warning);
    let geographic: DisruptionAssessmentRequest['checks']['geographic'] = {
      id: 'check-geographic',
      state: 'UNKNOWN',
      distanceMetres: null,
      toleranceMetres: null,
    };
    let routePosition: DisruptionAssessmentRequest['checks']['routePosition'] =
      {
        id: 'check-route-position',
        state: 'UNKNOWN',
      };

    if (warningGeometry) {
      const latitude = referenceLatitude([
        ...route.coordinates,
        ...warningGeometry,
      ]);
      const projectedRoute = routePoints(route, latitude);
      const samples = sampleLineString(
        warningGeometry.map((item) => toPoint(item, latitude)),
      );
      const vehicleRouteDistance =
        (vehicle.elapsedSeconds / 7_200) * projectedRoute.total;
      const projections = samples.map((item) =>
        projectOntoRoute(item, projectedRoute),
      );
      const remaining = projections.filter(
        (item) => item.routeDistanceMetres >= vehicleRouteDistance,
      );
      const minimumRemainingDistance = Math.min(
        ...remaining.map((item) => item.distanceToRouteMetres),
      );

      if (Number.isFinite(minimumRemainingDistance)) {
        geographic = {
          id: 'check-geographic',
          state:
            minimumRemainingDistance <= WARNING_ROUTE_TOLERANCE_METRES
              ? 'NEAR_REMAINING_ROUTE'
              : 'DISTANT',
          distanceMetres: minimumRemainingDistance,
          toleranceMetres: WARNING_ROUTE_TOLERANCE_METRES,
        };
      }

      const maxProjectionDistance = Math.max(
        ...projections.map((item) => item.distanceToRouteMetres),
      );
      if (maxProjectionDistance <= WARNING_ROUTE_TOLERANCE_METRES) {
        const last = Math.max(
          ...projections.map((item) => item.routeDistanceMetres),
        );
        routePosition = {
          id: 'check-route-position',
          state: last < vehicleRouteDistance ? 'BEHIND' : 'AHEAD_OR_ALONGSIDE',
        };
      }
    }

    const request = disruptionAssessmentRequestSchema.parse({
      assessmentId,
      shipment: {
        id: shipment.id,
        pickupCity: shipment.pickupLocation.city,
        destinationCity: shipment.destination.city,
        pickupAt: shipment.pickupAt.toISOString(),
        plannedDeliveryAt: shipment.plannedDeliveryAt.toISOString(),
      },
      vehicle: {
        id: vehicle.vehicleId,
        simulated: true,
        simulatedAt: vehicle.simulatedAt.toISOString(),
      },
      disruption: {
        evidenceId: `warning-${warning.id}`,
        source: warning.source,
        providerId: warning.providerId,
        ingestionMode: warning.ingestionMode,
        capturedAt: warning.capturedAt.toISOString(),
        queriedRoad: warning.queriedRoad,
        title: warning.title,
        subtitle: warning.subtitle,
        descriptions: strings(warning.description),
        startTimestamp: toContractTimestamp(warning.startTimestamp),
        endTimestamp: toContractTimestamp(warning.endTimestamp),
        delayMinutes: warning.delayMinutes,
      },
      checks: {
        geographic,
        direction: {
          id: 'check-direction',
          state: directionState(shipment, warning),
        },
        routePosition,
        timing: {
          id: 'check-timing',
          state: timingState(shipment, vehicle, warning),
        },
      },
      limitations: limitations(warning),
    });

    const exclusions = [
      request.checks.geographic.state === 'DISTANT' && 'geographic',
      request.checks.direction.state === 'CONFLICTING' && 'direction',
      request.checks.routePosition.state === 'BEHIND' && 'routePosition',
      request.checks.timing.state === 'CONFLICTING' && 'timing',
    ].filter((value): value is string => Boolean(value));

    return {
      request,
      excluded: exclusions.length > 0,
      exclusionReasons: exclusions,
    };
  }
}
