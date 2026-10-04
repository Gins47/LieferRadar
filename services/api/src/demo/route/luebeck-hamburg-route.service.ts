import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { DemoPosition } from '../model/demo-vehicle-state.model';

export const DEMO_JOURNEY_DURATION_SECONDS = 7_200;
export const APPROVED_ROUTE_HASH =
  'ecd9ff4cb5c273041800dec3912bacbd5c856f7a8a522c9f63ed3477d0ee2a2a';

const EARTH_RADIUS_METRES = 6_371_008.8;
const routeFixturePath = join(
  process.cwd(),
  'test',
  'fixtures',
  'routes',
  'luebeck-hamburg-a1.geojson',
);

export interface DemoRouteProvenance {
  attribution: string;
  profile: string;
  capturedAt: string;
  distanceMetres: number;
}

export interface DemoRoute {
  routeHash: string;
  coordinates: readonly DemoPosition[];
  provenance: DemoRouteProvenance;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function readString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`route fixture ${field} must be a nonempty string`);
  }

  return value;
}

function readNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`route fixture ${field} must be a finite number`);
  }

  return value;
}

function validatePosition(value: unknown, index: number): DemoPosition {
  if (
    !isUnknownArray(value) ||
    value.length !== 2 ||
    !value.every((coordinate) => typeof coordinate === 'number')
  ) {
    throw new Error(
      `route fixture coordinate ${index} must be [longitude, latitude]`,
    );
  }

  const [longitude, latitude] = value;
  if (
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude) ||
    longitude < -180 ||
    longitude > 180 ||
    latitude < -90 ||
    latitude > 90
  ) {
    throw new Error(
      `route fixture coordinate ${index} is outside WGS84 bounds`,
    );
  }

  return [longitude, latitude];
}

function haversineDistanceMetres(
  first: DemoPosition,
  second: DemoPosition,
): number {
  const latitudeDelta = ((second[1] - first[1]) * Math.PI) / 180;
  const longitudeDelta = ((second[0] - first[0]) * Math.PI) / 180;
  const firstLatitudeRadians = (first[1] * Math.PI) / 180;
  const secondLatitudeRadians = (second[1] * Math.PI) / 180;
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitudeRadians) *
      Math.cos(secondLatitudeRadians) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_METRES * Math.asin(Math.min(1, Math.sqrt(value)));
}

function interpolatePosition(
  first: DemoPosition,
  second: DemoPosition,
  fraction: number,
): DemoPosition {
  return [
    first[0] + (second[0] - first[0]) * fraction,
    first[1] + (second[1] - first[1]) * fraction,
  ];
}

function validateElapsedSeconds(elapsedSeconds: number): void {
  if (
    !Number.isInteger(elapsedSeconds) ||
    elapsedSeconds < 0 ||
    elapsedSeconds > DEMO_JOURNEY_DURATION_SECONDS
  ) {
    throw new RangeError(
      `elapsed simulation seconds must be an integer from 0 to ${DEMO_JOURNEY_DURATION_SECONDS}`,
    );
  }
}

export function calculateRoutePosition(
  coordinates: readonly DemoPosition[],
  elapsedSeconds: number,
): DemoPosition {
  validateElapsedSeconds(elapsedSeconds);

  const first = coordinates[0];
  const last = coordinates.at(-1);
  if (!first || !last) {
    throw new Error('route must contain at least one coordinate');
  }

  if (elapsedSeconds === 0) {
    return [...first];
  }

  if (elapsedSeconds === DEMO_JOURNEY_DURATION_SECONDS) {
    return [...last];
  }

  const segmentLengths = coordinates
    .slice(1)
    .map((coordinate, index) =>
      haversineDistanceMetres(coordinates[index], coordinate),
    );
  const totalDistance = segmentLengths.reduce(
    (total, segmentLength) => total + segmentLength,
    0,
  );

  if (totalDistance === 0) {
    return [...first];
  }

  const targetDistance =
    (totalDistance * elapsedSeconds) / DEMO_JOURNEY_DURATION_SECONDS;
  let traversedDistance = 0;

  for (let index = 0; index < segmentLengths.length; index += 1) {
    const segmentLength = segmentLengths[index];
    const segmentStart = coordinates[index];
    const segmentEnd = coordinates[index + 1];

    if (segmentLength === 0) {
      continue;
    }

    if (targetDistance <= traversedDistance + segmentLength) {
      return interpolatePosition(
        segmentStart,
        segmentEnd,
        (targetDistance - traversedDistance) / segmentLength,
      );
    }

    traversedDistance += segmentLength;
  }

  return [...last];
}

export function parseApprovedRouteFixture(
  contents: Buffer,
  approvedHash: string = APPROVED_ROUTE_HASH,
): DemoRoute {
  const routeHash = createHash('sha256').update(contents).digest('hex');
  if (routeHash !== approvedHash) {
    throw new Error('route fixture hash does not match the approved artifact');
  }

  let document: unknown;
  try {
    document = JSON.parse(contents.toString('utf8'));
  } catch {
    throw new Error('route fixture is not valid JSON');
  }

  if (!isRecord(document) || document.type !== 'FeatureCollection') {
    throw new Error('route fixture must be a GeoJSON FeatureCollection');
  }

  const features = document.features;
  const feature = isUnknownArray(features) ? features[0] : undefined;
  if (
    !isUnknownArray(features) ||
    features.length !== 1 ||
    !isRecord(feature)
  ) {
    throw new Error('route fixture must contain exactly one feature');
  }

  const geometry = feature.geometry;
  if (!isRecord(geometry) || geometry.type !== 'LineString') {
    throw new Error('route fixture feature must contain a LineString geometry');
  }

  const rawCoordinates = geometry.coordinates;
  if (!isUnknownArray(rawCoordinates) || rawCoordinates.length < 2) {
    throw new Error(
      'route fixture LineString must contain at least two coordinates',
    );
  }

  const metadata = document.metadata;
  const properties = feature.properties;
  if (
    !isRecord(metadata) ||
    !isRecord(metadata.query) ||
    !isRecord(properties)
  ) {
    throw new Error('route fixture provenance metadata is missing');
  }

  const summary = properties.summary;
  const capturedAt = new Date(
    readNumber(metadata.timestamp, 'metadata.timestamp'),
  );
  if (Number.isNaN(capturedAt.getTime())) {
    throw new Error('route fixture metadata.timestamp is invalid');
  }

  return {
    routeHash,
    coordinates: rawCoordinates.map(validatePosition),
    provenance: {
      attribution: readString(metadata.attribution, 'metadata.attribution'),
      profile: readString(metadata.query.profile, 'metadata.query.profile'),
      capturedAt: capturedAt.toISOString(),
      distanceMetres: readNumber(
        isRecord(summary) ? summary.distance : undefined,
        'properties.summary.distance',
      ),
    },
  };
}

@Injectable()
export class LuebeckHamburgRouteService {
  private readonly route = parseApprovedRouteFixture(
    readFileSync(routeFixturePath),
  );

  getRoute(): DemoRoute {
    return this.route;
  }

  positionAtElapsedSeconds(elapsedSeconds: number): DemoPosition {
    return calculateRoutePosition(this.route.coordinates, elapsedSeconds);
  }
}
