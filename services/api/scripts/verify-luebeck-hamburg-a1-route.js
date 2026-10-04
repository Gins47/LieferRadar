const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const routePath = join(
  __dirname,
  '..',
  'test',
  'fixtures',
  'routes',
  'luebeck-hamburg-a1.geojson',
);
const warningsPath = join(
  __dirname,
  '..',
  'test',
  'fixtures',
  'autobahn',
  'a1-warnings-2026-10.03.json',
);
const selectedProviderId =
  'INRIX--vi-avl.2026-10-03_06-53-00-000_003.de0';
const oppositeDirectionProviderId =
  'INRIX--vi-avl.2026-10-03_06-53-00-000_007.de0';
const unrelatedProviderId =
  'INRIX--vi-unf.2026-10-03_02-13-28-000_001.de0';
const maximumSampleSpacingMetres = 25;
const proximityToleranceMetres = 25;
const earthRadiusMetres = 6_371_008.8;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertPosition(position, context) {
  assert(
    Array.isArray(position) &&
      position.length >= 2 &&
      position.slice(0, 2).every(Number.isFinite) &&
      position[0] >= -180 &&
      position[0] <= 180 &&
      position[1] >= -90 &&
      position[1] <= 90,
    `${context} is not a finite WGS84 [longitude, latitude] coordinate`,
  );
}

function haversineDistanceMetres(first, second) {
  const [firstLongitude, firstLatitude] = first;
  const [secondLongitude, secondLatitude] = second;
  const latitudeDelta = ((secondLatitude - firstLatitude) * Math.PI) / 180;
  const longitudeDelta = ((secondLongitude - firstLongitude) * Math.PI) / 180;
  const firstLatitudeRadians = (firstLatitude * Math.PI) / 180;
  const secondLatitudeRadians = (secondLatitude * Math.PI) / 180;
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitudeRadians) *
      Math.cos(secondLatitudeRadians) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadiusMetres * Math.asin(Math.min(1, Math.sqrt(value)));
}

function interpolate(first, second, fraction) {
  return [
    first[0] + (second[0] - first[0]) * fraction,
    first[1] + (second[1] - first[1]) * fraction,
  ];
}

function routeLengthMetres(coordinates) {
  return coordinates.reduce(
    (total, coordinate, index) =>
      index === 0
        ? total
        : total + haversineDistanceMetres(coordinates[index - 1], coordinate),
    0,
  );
}

function project(point, referenceLatitudeRadians) {
  return [
    earthRadiusMetres * ((point[0] * Math.PI) / 180) * Math.cos(referenceLatitudeRadians),
    earthRadiusMetres * ((point[1] * Math.PI) / 180),
  ];
}

function nearestRoutePosition(point, routeCoordinates, routeSegmentLengths) {
  const referenceLatitudeRadians = (point[1] * Math.PI) / 180;
  const projectedPoint = project(point, referenceLatitudeRadians);
  let routeDistanceMetres = 0;
  let nearest = { distanceMetres: Infinity, routeDistanceMetres: 0 };

  for (let index = 0; index < routeCoordinates.length - 1; index += 1) {
    const first = project(routeCoordinates[index], referenceLatitudeRadians);
    const second = project(routeCoordinates[index + 1], referenceLatitudeRadians);
    const deltaX = second[0] - first[0];
    const deltaY = second[1] - first[1];
    const denominator = deltaX ** 2 + deltaY ** 2;
    const fraction =
      denominator === 0
        ? 0
        : Math.max(
            0,
            Math.min(
              1,
              ((projectedPoint[0] - first[0]) * deltaX +
                (projectedPoint[1] - first[1]) * deltaY) /
                denominator,
            ),
          );
    const nearestX = first[0] + fraction * deltaX;
    const nearestY = first[1] + fraction * deltaY;
    const distanceMetres = Math.hypot(
      projectedPoint[0] - nearestX,
      projectedPoint[1] - nearestY,
    );

    if (distanceMetres < nearest.distanceMetres) {
      nearest = {
        distanceMetres,
        routeDistanceMetres:
          routeDistanceMetres + fraction * routeSegmentLengths[index],
      };
    }
    routeDistanceMetres += routeSegmentLengths[index];
  }

  return nearest;
}

function sampleLineString(coordinates) {
  const samples = [];
  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const first = coordinates[index];
    const second = coordinates[index + 1];
    const count = Math.max(
      1,
      Math.ceil(
        haversineDistanceMetres(first, second) / maximumSampleSpacingMetres,
      ),
    );
    for (let step = 0; step < count; step += 1) {
      samples.push(interpolate(first, second, step / count));
    }
  }
  samples.push(coordinates.at(-1));
  return samples;
}

function compareWarning(warning, routeCoordinates, routeSegmentLengths) {
  const warningCoordinates = warning.geometry.coordinates;
  const samples = sampleLineString(warningCoordinates);
  const nearestSamples = samples.map((sample) =>
    nearestRoutePosition(sample, routeCoordinates, routeSegmentLengths),
  );
  const start = nearestRoutePosition(
    warningCoordinates[0],
    routeCoordinates,
    routeSegmentLengths,
  );
  const end = nearestRoutePosition(
    warningCoordinates.at(-1),
    routeCoordinates,
    routeSegmentLengths,
  );

  return {
    providerId: warning.identifier,
    direction: warning.subtitle.trim(),
    warningLengthMetres: Number(routeLengthMetres(warningCoordinates).toFixed(2)),
    samples: samples.length,
    maximumSampleSpacingMetres,
    minimumDistanceMetres: Number(
      Math.min(...nearestSamples.map(({ distanceMetres }) => distanceMetres)).toFixed(3),
    ),
    maximumDistanceMetres: Number(
      Math.max(...nearestSamples.map(({ distanceMetres }) => distanceMetres)).toFixed(3),
    ),
    samplesWithinTolerancePercent: Number(
      (
        (100 *
          nearestSamples.filter(
            ({ distanceMetres }) => distanceMetres <= proximityToleranceMetres,
          ).length) /
        nearestSamples.length
      ).toFixed(2),
    ),
    startRouteDistanceMetres: Number(start.routeDistanceMetres.toFixed(2)),
    endRouteDistanceMetres: Number(end.routeDistanceMetres.toFixed(2)),
  };
}

function main() {
  const routeBytes = readFileSync(routePath);
  const route = JSON.parse(routeBytes.toString('utf8'));
  const warnings = JSON.parse(readFileSync(warningsPath, 'utf8'));

  assert(route.type === 'FeatureCollection', 'route must be a FeatureCollection');
  assert(route.features.length === 1, 'route must contain exactly one feature');
  const feature = route.features[0];
  assert(feature.geometry?.type === 'LineString', 'route must be a LineString');
  const routeCoordinates = feature.geometry.coordinates;
  assert(routeCoordinates.length === 644, 'route must contain 644 coordinates');
  routeCoordinates.forEach((position, index) =>
    assertPosition(position, `route coordinate ${index}`),
  );
  assert(
    route.metadata?.query?.profile === 'driving-car',
    'route metadata must retain the driving-car profile',
  );
  assert(
    route.metadata?.attribution === 'openrouteservice.org | OpenStreetMap contributors',
    'route attribution does not match the saved export',
  );
  assert(Array.isArray(warnings.warning), 'warning fixture must contain warning[]');

  const byProviderId = new Map(
    warnings.warning.map((warning) => [warning.identifier, warning]),
  );
  const selected = byProviderId.get(selectedProviderId);
  const opposite = byProviderId.get(oppositeDirectionProviderId);
  const unrelated = byProviderId.get(unrelatedProviderId);
  assert(selected && opposite && unrelated, 'expected A1 warning fixtures are missing');
  for (const warning of [selected, opposite, unrelated]) {
    assert(
      warning.geometry?.type === 'LineString' && warning.geometry.coordinates.length > 1,
      `warning ${warning.identifier} must have a LineString`,
    );
    warning.geometry.coordinates.forEach((position, index) =>
      assertPosition(position, `warning ${warning.identifier} coordinate ${index}`),
    );
  }

  const routeSegmentLengths = routeCoordinates.slice(1).map((coordinate, index) =>
    haversineDistanceMetres(routeCoordinates[index], coordinate),
  );
  const selectedComparison = compareWarning(
    selected,
    routeCoordinates,
    routeSegmentLengths,
  );
  const oppositeComparison = compareWarning(
    opposite,
    routeCoordinates,
    routeSegmentLengths,
  );
  const unrelatedComparison = compareWarning(
    unrelated,
    routeCoordinates,
    routeSegmentLengths,
  );

  assert(
    selectedComparison.maximumDistanceMetres <= proximityToleranceMetres,
    'selected warning does not stay within the route proximity tolerance',
  );
  assert(
    selectedComparison.endRouteDistanceMetres >
      selectedComparison.startRouteDistanceMetres,
    'selected warning does not follow the route travel direction',
  );
  assert(
    oppositeComparison.endRouteDistanceMetres <
      oppositeComparison.startRouteDistanceMetres,
    'opposite-direction warning does not oppose the route travel direction',
  );
  assert(
    unrelatedComparison.minimumDistanceMetres > 200_000,
    'unrelated warning is unexpectedly near the route',
  );

  const output = {
    verificationVersion: 1,
    route: {
      file: 'services/api/test/fixtures/routes/luebeck-hamburg-a1.geojson',
      sha256: createHash('sha256').update(routeBytes).digest('hex'),
      coordinates: routeCoordinates.length,
      computedLengthMetres: Number(routeLengthMetres(routeCoordinates).toFixed(2)),
      providerLengthMetres: feature.properties.summary.distance,
      providerDurationSeconds: feature.properties.summary.duration,
      profile: route.metadata.query.profile,
      capturedAt: new Date(route.metadata.timestamp).toISOString(),
      attribution: route.metadata.attribution,
      start: routeCoordinates[0],
      end: routeCoordinates.at(-1),
    },
    comparison: {
      method:
        'Haversine segment length; local equirectangular point-to-segment projection at each sample latitude; warning segments sampled at no more than 25 metres.',
      toleranceMetres: proximityToleranceMetres,
      selected: selectedComparison,
      oppositeDirection: oppositeComparison,
      unrelated: unrelatedComparison,
    },
  };

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main();
