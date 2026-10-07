import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { normalizeAutobahnWarning } from '../integrations/autobahn/autobahn-warning.mapper';
import { ShipmentView } from '../logistics/model/shipment-view.model';
import {
  DEMO_SHIPMENT_003_ID,
  DEMO_SHIPMENT_004_ID,
  DEMO_SHIPMENT_ID,
  DEMO_VEHICLE_003_ID,
  DEMO_VEHICLE_004_ID,
  DEMO_VEHICLE_ID,
  SELECTED_WARNING_PROVIDER_ID,
  SELECTED_WARNING_SOURCE,
  SHIPMENT_003_ELAPSED_SECONDS,
} from './demo-preparation.service';
import { DemoEvidenceService } from './demo-evidence.service';
import { DemoService } from './demo.service';
import { DemoVehicleState } from './model/demo-vehicle-state.model';
import { LuebeckHamburgRouteService } from './route/luebeck-hamburg-route.service';

const route = new LuebeckHamburgRouteService();
const evidence = new DemoEvidenceService(route);
const warningFixture = JSON.parse(
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

function selectedWarning(ingestionMode: 'LIVE' | 'REPLAY' = 'REPLAY') {
  const raw = warningFixture.warning.find(
    (value) =>
      typeof value === 'object' &&
      value !== null &&
      (value as { identifier?: string }).identifier ===
        SELECTED_WARNING_PROVIDER_ID,
  );
  return normalizeAutobahnWarning(
    raw,
    'A1',
    new Date('2026-10-03T07:00:00.000Z'),
    ingestionMode,
  );
}

function shipment(id: string): ShipmentView {
  return {
    id,
    supplier: {
      id: 'SUP-002',
      name: 'Lübeck Demo Supplier',
      location: { city: 'Lübeck', countryCode: 'DE' },
    },
    product: { id: 'PROD-001', sku: 'ECU-CTRL-01', name: 'ECU Controller' },
    quantity: 500,
    pickupLocation: { city: 'Lübeck', countryCode: 'DE' },
    destination: { city: 'Hamburg', countryCode: 'DE' },
    plannedRoute: ['A1'],
    status: 'IN_TRANSIT',
    pickupAt: new Date('2026-10-03T06:30:00.000Z'),
    plannedDeliveryAt: new Date('2026-10-03T08:30:00.000Z'),
  };
}

function vehicle(
  vehicleId: string,
  elapsedSeconds: number,
  position: [number, number],
  simulatedAt: string,
): DemoVehicleState {
  return {
    vehicleId,
    driver: {
      name: 'Demo Driver',
      email: 'driver@example.invalid',
      phone: '+49 000 0000000',
    },
    routeHash: route.getRoute().routeHash,
    elapsedSeconds,
    position,
    simulatedAt: new Date(simulatedAt),
    revision: 0,
    updatedAt: new Date('2026-10-05T08:00:00.000Z'),
  };
}

const contexts = new Map([
  [
    DEMO_SHIPMENT_ID,
    vehicle(
      DEMO_VEHICLE_ID,
      3_840,
      [10.326863322601533, 53.701048700082],
      '2026-10-03T07:34:00.000Z',
    ),
  ],
  [
    DEMO_SHIPMENT_003_ID,
    vehicle(
      DEMO_VEHICLE_003_ID,
      SHIPMENT_003_ELAPSED_SECONDS,
      [10.236442, 53.620842],
      '2026-10-03T07:53:24.000Z',
    ),
  ],
  [
    DEMO_SHIPMENT_004_ID,
    vehicle(
      DEMO_VEHICLE_004_ID,
      0,
      [10.686606, 53.865509],
      '2026-10-03T06:30:00.000Z',
    ),
  ],
]);

describe('prepared A1 demo contexts', () => {
  function createService(warning = selectedWarning()): {
    service: DemoService;
    shipments: { getShipment: jest.Mock };
    vehicles: { findByShipmentId: jest.Mock };
  } {
    const shipments = {
      getShipment: jest.fn((id: string) => Promise.resolve(shipment(id))),
    };
    const disruptions = {
      findByProviderIdentity: jest.fn().mockResolvedValue(warning),
    };
    const vehicles = {
      findByShipmentId: jest.fn((id: string) =>
        Promise.resolve(contexts.get(id)),
      ),
      updatePositionIfRevision: jest.fn(),
    };

    return {
      service: new DemoService(
        shipments as never,
        disruptions as never,
        vehicles as never,
        route,
        evidence,
      ),
      shipments,
      vehicles,
    };
  }

  it('evaluates all supported prepared contexts through the same deterministic path without a network call', async () => {
    const { service } = createService();
    const fetch = jest.spyOn(global, 'fetch');
    fetch.mockImplementation(jest.fn());

    try {
      await expect(
        service.getShipmentScenario(DEMO_SHIPMENT_ID),
      ).resolves.toMatchObject({
        warning: {
          source: SELECTED_WARNING_SOURCE,
          providerId: SELECTED_WARNING_PROVIDER_ID,
          ingestionMode: 'REPLAY',
        },
        operatorReview: {
          state: 'NEEDS_REVIEW',
          evidence: {
            excluded: false,
            checks: {
              geographic: { state: 'NEAR_REMAINING_ROUTE' },
              direction: { state: 'COMPATIBLE' },
              routePosition: { state: 'AHEAD_OR_ALONGSIDE' },
              timing: { state: 'POSSIBLE' },
            },
          },
        },
      });
      await expect(
        service.getShipmentScenario(DEMO_SHIPMENT_003_ID),
      ).resolves.toMatchObject({
        warning: {
          source: SELECTED_WARNING_SOURCE,
          providerId: SELECTED_WARNING_PROVIDER_ID,
          ingestionMode: 'REPLAY',
        },
        operatorReview: {
          state: 'EXCLUDED',
          evidence: {
            excluded: true,
            exclusionReasons: ['routePosition'],
            checks: {
              geographic: { state: 'UNKNOWN' },
              direction: { state: 'COMPATIBLE' },
              routePosition: { state: 'BEHIND' },
              timing: { state: 'POSSIBLE' },
            },
          },
        },
      });
      await expect(
        service.getShipmentScenario(DEMO_SHIPMENT_004_ID),
      ).resolves.toMatchObject({
        warning: {
          source: SELECTED_WARNING_SOURCE,
          providerId: SELECTED_WARNING_PROVIDER_ID,
          ingestionMode: 'REPLAY',
        },
        operatorReview: {
          state: 'WARNING_NOT_YET_OBSERVED',
          evidence: {
            excluded: false,
            checks: {
              geographic: { state: 'NEAR_REMAINING_ROUTE' },
              direction: { state: 'COMPATIBLE' },
              routePosition: { state: 'AHEAD_OR_ALONGSIDE' },
              timing: { state: 'POSSIBLE' },
            },
          },
        },
      });
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      fetch.mockRestore();
    }
  });

  it('does not let an unsupported shipment borrow a prepared context', async () => {
    const { service, shipments, vehicles } = createService();

    await expect(
      service.getShipmentScenario('SHP-NORMAL'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(shipments.getShipment).not.toHaveBeenCalled();
    expect(vehicles.findByShipmentId).not.toHaveBeenCalled();
  });

  it('rejects LIVE state instead of substituting it for the selected historical REPLAY warning', async () => {
    const { service } = createService(selectedWarning('LIVE'));

    await expect(
      service.getShipmentScenario(DEMO_SHIPMENT_003_ID),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
