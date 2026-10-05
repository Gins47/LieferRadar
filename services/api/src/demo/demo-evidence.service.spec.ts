import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeAutobahnWarning } from '../integrations/autobahn/autobahn-warning.mapper';
import { Disruption } from '../disruption/model/disruption.model';
import { ShipmentView } from '../logistics/model/shipment-view.model';
import { DemoVehicleState } from './model/demo-vehicle-state.model';
import { DemoEvidenceService } from './demo-evidence.service';
import { LuebeckHamburgRouteService } from './route/luebeck-hamburg-route.service';

const route = new LuebeckHamburgRouteService();
const service = new DemoEvidenceService(route);
const warnings = JSON.parse(
  readFileSync(
    join(
      process.cwd(),
      'test',
      'fixtures',
      'autobahn',
      'a1-warnings-2026-10.03.json',
    ),
    'utf8',
  ),
) as { warning: unknown[] };

function warning(identifier: string): Disruption {
  const raw = warnings.warning.find(
    (value) =>
      typeof value === 'object' &&
      value !== null &&
      (value as { identifier?: string }).identifier === identifier,
  );
  return normalizeAutobahnWarning(
    raw,
    'A1',
    new Date('2026-10-03T07:00:00Z'),
    'REPLAY',
  );
}

function shipment(): ShipmentView {
  return {
    id: 'SHP-002',
    supplier: {
      id: 'SUP-002',
      name: 'Demo',
      location: { city: 'Lübeck', countryCode: 'DE' },
    },
    product: { id: 'PROD-001', sku: 'SKU', name: 'Product' },
    quantity: 500,
    pickupLocation: { city: 'Lübeck', countryCode: 'DE' },
    destination: { city: 'Hamburg', countryCode: 'DE' },
    plannedRoute: ['A1'],
    status: 'PLANNED',
    pickupAt: new Date('2026-10-03T06:30:00Z'),
    plannedDeliveryAt: new Date('2026-10-03T08:30:00Z'),
  };
}

function vehicle(overrides: Partial<DemoVehicleState> = {}): DemoVehicleState {
  const elapsedSeconds = overrides.elapsedSeconds ?? 3_840;
  return {
    vehicleId: 'VEH-DEMO-002',
    driver: {
      name: 'Alex Demo',
      email: 'driver@example.invalid',
      phone: '+49000',
    },
    routeHash: route.getRoute().routeHash,
    elapsedSeconds,
    position: route.positionAtElapsedSeconds(elapsedSeconds),
    simulatedAt: new Date('2026-10-03T07:34:00Z'),
    revision: 1,
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('DemoEvidenceService', () => {
  it('prepares the approved SHP-002 candidate with all four deterministic checks', () => {
    const evidence = service.prepare(
      shipment(),
      vehicle(),
      warning('INRIX--vi-avl.2026-10-03_06-53-00-000_003.de0'),
      'assessment-1',
    );

    expect(evidence.excluded).toBe(false);
    expect(evidence.request.checks).toMatchObject({
      geographic: { state: 'NEAR_REMAINING_ROUTE', toleranceMetres: 25 },
      direction: { state: 'COMPATIBLE' },
      routePosition: { state: 'AHEAD_OR_ALONGSIDE' },
      timing: { state: 'POSSIBLE' },
    });
    expect(evidence.request.limitations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'limitation-missing-end-timestamp' }),
      ]),
    );
  });

  it('excludes definite distant, opposite-direction, behind, and timing controls', () => {
    const selected = warning('INRIX--vi-avl.2026-10-03_06-53-00-000_003.de0');
    const distant = {
      ...selected,
      geometry: {
        type: 'LineString',
        coordinates: [
          [8, 50],
          [8.01, 50.01],
        ],
      },
    };
    expect(
      service.prepare(shipment(), vehicle(), distant, 'distant').request.checks
        .geographic.state,
    ).toBe('DISTANT');

    const opposite = warning('INRIX--vi-avl.2026-10-03_06-53-00-000_007.de0');
    expect(
      service.prepare(shipment(), vehicle(), opposite, 'opposite').request
        .checks.direction.state,
    ).toBe('CONFLICTING');

    const behind = service.prepare(
      shipment(),
      vehicle({
        elapsedSeconds: 5_000,
        simulatedAt: new Date('2026-10-03T07:53:20Z'),
      }),
      selected,
      'behind',
    );
    expect(behind.request.checks.routePosition.state).toBe('BEHIND');

    const timing = {
      ...selected,
      startTimestamp: {
        kind: 'value' as const,
        value: new Date('2026-10-03T09:00:00Z'),
      },
    };
    expect(
      service.prepare(shipment(), vehicle(), timing, 'timing').request.checks
        .timing.state,
    ).toBe('CONFLICTING');
  });

  it('keeps missing geometry, direction, and timing as eligible UNKNOWN evidence', () => {
    const incomplete = {
      ...warning('INRIX--vi-avl.2026-10-03_06-53-00-000_003.de0'),
      geometry: null,
      subtitle: null,
      startTimestamp: { kind: 'omitted' as const },
    };
    const evidence = service.prepare(
      shipment(),
      vehicle(),
      incomplete,
      'unknown',
    );

    expect(evidence.excluded).toBe(false);
    expect(evidence.request.checks).toMatchObject({
      geographic: { state: 'UNKNOWN' },
      direction: { state: 'UNKNOWN' },
      routePosition: { state: 'UNKNOWN' },
      timing: { state: 'UNKNOWN' },
    });
  });
});
