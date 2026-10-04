import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  APPROVED_ROUTE_HASH,
  calculateRoutePosition,
  LuebeckHamburgRouteService,
  parseApprovedRouteFixture,
} from './luebeck-hamburg-route.service';

const routeFixture = readFileSync(
  join(
    process.cwd(),
    'test',
    'fixtures',
    'routes',
    'luebeck-hamburg-a1.geojson',
  ),
);

describe('LuebeckHamburgRouteService', () => {
  const service = new LuebeckHamburgRouteService();

  it('loads the approved passenger-car demonstration route and provenance', () => {
    const route = service.getRoute();

    expect(route.routeHash).toBe(APPROVED_ROUTE_HASH);
    expect(route.coordinates).toHaveLength(644);
    expect(route.coordinates[0]).toEqual([10.686606, 53.865509]);
    expect(route.coordinates.at(-1)).toEqual([10.000857, 53.550633]);
    expect(route.provenance).toEqual({
      attribution: 'openrouteservice.org | OpenStreetMap contributors',
      profile: 'driving-car',
      capturedAt: '2026-10-04T06:47:53.593Z',
      distanceMetres: 68242.2,
    });
  });

  it('returns the exact route endpoints at the simulation boundaries', () => {
    expect(service.positionAtElapsedSeconds(0)).toEqual([10.686606, 53.865509]);
    expect(service.positionAtElapsedSeconds(7_200)).toEqual([
      10.000857, 53.550633,
    ]);
  });

  it('calculates the same intermediate position repeatedly', () => {
    const firstCalculation = service.positionAtElapsedSeconds(3_600);
    const secondCalculation = service.positionAtElapsedSeconds(3_600);

    expect(firstCalculation).toEqual(secondCalculation);
    expect(firstCalculation).not.toEqual(service.getRoute().coordinates[0]);
    expect(firstCalculation).not.toEqual(service.getRoute().coordinates.at(-1));
  });

  it('skips repeated coordinates and zero-length segments safely', () => {
    expect(
      calculateRoutePosition(
        [
          [0, 0],
          [0, 0],
          [2, 0],
        ],
        3_600,
      ),
    ).toEqual([1, 0]);
    expect(
      calculateRoutePosition(
        [
          [0, 0],
          [0, 0],
        ],
        3_600,
      ),
    ).toEqual([0, 0]);
  });

  it.each([-1, 7_201, 1.5, Number.NaN])(
    'rejects invalid elapsed seconds: %s',
    (elapsedSeconds) => {
      expect(() => service.positionAtElapsedSeconds(elapsedSeconds)).toThrow(
        RangeError,
      );
    },
  );

  it('rejects a route fixture whose hash does not match the approved artifact', () => {
    expect(() =>
      parseApprovedRouteFixture(routeFixture, '0'.repeat(64)),
    ).toThrow('route fixture hash does not match the approved artifact');
  });

  it('rejects invalid geometry after the fixture hash is verified', () => {
    const invalidFixture = Buffer.from(
      JSON.stringify({ type: 'FeatureCollection', features: [] }),
    );
    const invalidFixtureHash = createHash('sha256')
      .update(invalidFixture)
      .digest('hex');

    expect(() =>
      parseApprovedRouteFixture(invalidFixture, invalidFixtureHash),
    ).toThrow('route fixture must contain exactly one feature');
  });
});
