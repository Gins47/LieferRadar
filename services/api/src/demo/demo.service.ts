import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Disruption } from '../disruption/model/disruption.model';
import { PostgresDisruptionRepository } from '../disruption/repository/postgres-disruption.repository';
import { ShipmentService } from '../shipment/shipment.service';
import {
  DEMO_SHIPMENT_ID,
  DEMO_START_AT,
  SELECTED_WARNING_PROVIDER_ID,
  SELECTED_WARNING_SOURCE,
  SUPPORTED_DEMO_SHIPMENT_IDS,
} from './demo-preparation.service';
import {
  DemoVehicleState,
  DemoPosition,
} from './model/demo-vehicle-state.model';
import { DemoVehiclePositionRequest } from './demo-position.dto';
import { PostgresDemoVehicleRepository } from './repository/postgres-demo-vehicle.repository';
import { LuebeckHamburgRouteService } from './route/luebeck-hamburg-route.service';
import { DemoEvidenceService } from './demo-evidence.service';

export const NEAR_DISRUPTION_ELAPSED_SECONDS = 3_840;

const START_POSITION: DemoPosition = [10.686606, 53.865509];

const NEAR_DISRUPTION_POSITION: DemoPosition = [10.3268633226, 53.7010487001];

type DemoPositionName = DemoVehiclePositionRequest['position'];

interface DemoPositionTarget {
  elapsedSeconds: number;
  simulatedAt: Date;
}

interface DemoPositionTarget {
  elapsedSeconds: number;
  simulatedAt: Date;
  position: DemoPosition;
}

function targetForPosition(position: DemoPositionName): DemoPositionTarget {
  const isStart = position === 'START';

  const elapsedSeconds = isStart ? 0 : NEAR_DISRUPTION_ELAPSED_SECONDS;

  return {
    elapsedSeconds,
    simulatedAt: new Date(DEMO_START_AT.getTime() + elapsedSeconds * 1_000),
    position: isStart ? START_POSITION : NEAR_DISRUPTION_POSITION,
  };
}

function mapWarning(warning: Disruption) {
  return {
    id: warning.id,
    source: warning.source,
    providerId: warning.providerId,
    queriedRoad: warning.queriedRoad,
    title: warning.title,
    subtitle: warning.subtitle,
    descriptions: warning.description,
    startTimestamp: warning.startTimestamp,
    endTimestamp: warning.endTimestamp,
    delayMinutes: warning.delayMinutes,
    geometry: warning.geometry,
    ingestionMode: warning.ingestionMode,
    capturedAt: warning.capturedAt,
  };
}

@Injectable()
export class DemoService {
  constructor(
    private readonly shipments: ShipmentService,
    private readonly disruptions: PostgresDisruptionRepository,
    private readonly vehicles: PostgresDemoVehicleRepository,
    private readonly route: LuebeckHamburgRouteService,
    private readonly evidence: DemoEvidenceService,
  ) {}

  async getShipmentScenario(shipmentId: string) {
    const { shipment, vehicle, warning } =
      await this.getPreparedScenario(shipmentId);
    const route = this.route.getRoute();
    const operatorReview = this.getOperatorReview(shipment, vehicle, warning);

    return {
      shipment,
      vehicle,
      route: {
        routeHash: route.routeHash,
        coordinates: route.coordinates,
        provenance: route.provenance,
      },
      warning: mapWarning(warning),
      operatorReview,
    };
  }

  getOperatorReview(
    shipment: Awaited<ReturnType<ShipmentService['getShipment']>>,
    vehicle: DemoVehicleState,
    warning: Disruption,
  ) {
    const evidence = this.evidence.prepare(
      shipment,
      vehicle,
      warning,
      '00000000-0000-4000-8000-000000000004',
    );
    const checks = evidence.request.checks;
    const observed = vehicle.simulatedAt >= warning.capturedAt;
    const positive =
      checks.geographic.state === 'NEAR_REMAINING_ROUTE' &&
      checks.direction.state === 'COMPATIBLE' &&
      checks.routePosition.state === 'AHEAD_OR_ALONGSIDE' &&
      checks.timing.state === 'POSSIBLE';
    const hasUnknown = Object.values(checks).some(
      (check) => check.state === 'UNKNOWN',
    );

    const state = !observed
      ? 'WARNING_NOT_YET_OBSERVED'
      : evidence.excluded
        ? 'EXCLUDED'
        : positive
          ? 'NEEDS_REVIEW'
          : hasUnknown
            ? 'INCOMPLETE_EVIDENCE'
            : 'INCOMPLETE_EVIDENCE';
    const reason = !observed
      ? 'The historical warning had not yet been observed at the simulated vehicle time.'
      : evidence.excluded
        ? `A deterministic check excludes this scenario: ${evidence.exclusionReasons.join(', ')}.`
        : positive
          ? 'The observable historical warning is near the remaining route, ahead of the simulated vehicle, direction-compatible and timing-possible.'
          : 'The available deterministic evidence is incomplete and does not establish a review outcome.';

    return {
      state,
      reason,
      needsAttention: state === 'NEEDS_REVIEW',
      evidence: {
        checks,
        limitations: evidence.request.limitations,
        excluded: evidence.excluded,
        exclusionReasons: evidence.exclusionReasons,
      },
    };
  }

  async setVehiclePosition(
    shipmentId: string,
    request: DemoVehiclePositionRequest,
  ) {
    if (shipmentId !== DEMO_SHIPMENT_ID) {
      throw new NotFoundException('demo shipment position is not supported');
    }
    const { vehicle } = await this.getPreparedScenario(shipmentId);
    const target = targetForPosition(request.position);
    const updated = await this.vehicles.updatePositionIfRevision(
      vehicle.vehicleId,
      request.expectedRevision,
      {
        elapsedSeconds: target.elapsedSeconds,
        position: target.position,
        simulatedAt: target.simulatedAt,
      },
    );

    if (!updated) {
      throw new ConflictException(
        'demo vehicle state has changed; refresh and retry',
      );
    }

    return updated;
  }

  async getPreparedScenario(shipmentId: string): Promise<{
    shipment: Awaited<ReturnType<ShipmentService['getShipment']>>;
    vehicle: DemoVehicleState;
    warning: Disruption;
  }> {
    if (!SUPPORTED_DEMO_SHIPMENT_IDS.some((id) => id === shipmentId)) {
      throw new NotFoundException('demo shipment not found');
    }

    const [shipment, vehicle, warning] = await Promise.all([
      this.shipments.getShipment(shipmentId),
      this.vehicles.findByShipmentId(shipmentId),
      this.disruptions.findByProviderIdentity(
        SELECTED_WARNING_SOURCE,
        SELECTED_WARNING_PROVIDER_ID,
      ),
    ]);

    if (!vehicle) {
      throw new ConflictException('demo scenario has not been prepared');
    }
    if (vehicle.routeHash !== this.route.getRoute().routeHash) {
      throw new ConflictException(
        'demo vehicle state has an incompatible route',
      );
    }
    if (!warning) {
      throw new ConflictException(
        'selected historical replay warning is unavailable',
      );
    }
    if (warning.ingestionMode !== 'REPLAY') {
      throw new ConflictException(
        'selected historical replay warning is unavailable because newer LIVE state is persisted',
      );
    }

    return { shipment, vehicle, warning };
  }
}
