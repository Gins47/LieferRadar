import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  DEMO_SHIPMENT_ID,
  DEMO_START_AT,
  DEMO_VEHICLE_ID,
  SELECTED_WARNING_PROVIDER_ID,
  SELECTED_WARNING_SOURCE,
} from './demo-preparation.service';
import { DemoService, NEAR_DISRUPTION_ELAPSED_SECONDS } from './demo.service';
import { DemoVehicleState } from './model/demo-vehicle-state.model';

const routeHash = 'a'.repeat(64);
const startPosition: [number, number] = [10.686606, 53.865509];
const nearDisruptionPosition: [number, number] = [
  10.326863322601533, 53.701048700082,
];

function vehicleState(
  overrides: Partial<DemoVehicleState> = {},
): DemoVehicleState {
  return {
    vehicleId: DEMO_VEHICLE_ID,
    driver: {
      name: 'Alex Demo',
      email: 'driver-shp002@example.invalid',
      phone: '+49 000 0000002',
    },
    routeHash,
    elapsedSeconds: 0,
    position: startPosition,
    simulatedAt: DEMO_START_AT,
    revision: 0,
    updatedAt: new Date('2026-10-05T08:00:00.000Z'),
    ...overrides,
  };
}

function warning(ingestionMode: 'LIVE' | 'REPLAY' = 'REPLAY') {
  return {
    id: 'warning-1',
    source: SELECTED_WARNING_SOURCE,
    providerId: SELECTED_WARNING_PROVIDER_ID,
    queriedRoad: 'A1',
    title: 'A1 | Bargteheide - Ahrensburg',
    subtitle: null,
    description: ['Warnung'],
    startTimestamp: { kind: 'value', value: new Date('2026-10-03T06:53:00Z') },
    endTimestamp: { kind: 'omitted' },
    delayMinutes: 18,
    geometry: { type: 'LineString', coordinates: [] },
    ingestionMode,
    capturedAt: new Date('2026-10-03T07:00:00Z'),
  };
}

describe('DemoService', () => {
  function createService(
    options: {
      vehicle?: DemoVehicleState;
      selectedWarning?: ReturnType<typeof warning>;
      updateResult?: DemoVehicleState;
    } = {},
  ) {
    const shipments = {
      getShipment: jest.fn().mockResolvedValue({
        id: DEMO_SHIPMENT_ID,
        pickupLocation: { city: 'Lübeck', countryCode: 'DE' },
        destination: { city: 'Hamburg', countryCode: 'DE' },
        status: 'PLANNED',
      }),
    };
    const disruptions = {
      findByProviderIdentity: jest
        .fn()
        .mockResolvedValue(options.selectedWarning ?? warning()),
    };
    const vehicles = {
      findByShipmentId: jest
        .fn()
        .mockResolvedValue(options.vehicle ?? vehicleState()),
      updatePositionIfRevision: jest
        .fn()
        .mockResolvedValue(
          options.updateResult ?? vehicleState({ revision: 1 }),
        ),
    };
    const route = {
      getRoute: () => ({
        routeHash,
        coordinates: [startPosition, nearDisruptionPosition],
        provenance: { attribution: 'test', profile: 'driving-car' },
      }),
      positionAtElapsedSeconds: jest.fn((elapsedSeconds: number) =>
        elapsedSeconds === 0 ? startPosition : nearDisruptionPosition,
      ),
    };

    return {
      service: new DemoService(
        shipments as never,
        disruptions as never,
        vehicles as never,
        route as never,
      ),
      disruptions,
      vehicles,
      route,
    };
  }

  it('returns only the prepared SHP-002 scenario with the exact REPLAY warning', async () => {
    const { service, disruptions } = createService();

    await expect(
      service.getShipmentScenario(DEMO_SHIPMENT_ID),
    ).resolves.toMatchObject({
      shipment: { id: DEMO_SHIPMENT_ID },
      vehicle: vehicleState(),
      route: {
        routeHash,
        coordinates: [startPosition, nearDisruptionPosition],
      },
      warning: {
        source: SELECTED_WARNING_SOURCE,
        providerId: SELECTED_WARNING_PROVIDER_ID,
        ingestionMode: 'REPLAY',
      },
    });
    expect(disruptions.findByProviderIdentity).toHaveBeenCalledWith(
      SELECTED_WARNING_SOURCE,
      SELECTED_WARNING_PROVIDER_ID,
    );
  });

  it('maps NEAR_DISRUPTION to the fixed validated route offset and atomically increments revision', async () => {
    const updated = vehicleState({
      elapsedSeconds: NEAR_DISRUPTION_ELAPSED_SECONDS,
      position: nearDisruptionPosition,
      simulatedAt: new Date('2026-10-03T07:34:00.000Z'),
      revision: 1,
    });
    const { service, route, vehicles } = createService({
      updateResult: updated,
    });

    await expect(
      service.setVehiclePosition(DEMO_SHIPMENT_ID, {
        position: 'NEAR_DISRUPTION',
        expectedRevision: 0,
      }),
    ).resolves.toEqual(updated);
    expect(route.positionAtElapsedSeconds).toHaveBeenCalledWith(
      NEAR_DISRUPTION_ELAPSED_SECONDS,
    );
    expect(vehicles.updatePositionIfRevision).toHaveBeenCalledWith(
      DEMO_VEHICLE_ID,
      0,
      {
        elapsedSeconds: NEAR_DISRUPTION_ELAPSED_SECONDS,
        position: nearDisruptionPosition,
        simulatedAt: new Date('2026-10-03T07:34:00.000Z'),
      },
    );
  });

  it('fails visibly for an unprepared or incompatible scenario', async () => {
    const unprepared = createService({ vehicle: undefined });
    unprepared.vehicles.findByShipmentId.mockResolvedValue(undefined);
    await expect(
      unprepared.service.getShipmentScenario(DEMO_SHIPMENT_ID),
    ).rejects.toBeInstanceOf(ConflictException);

    const incompatible = createService({
      vehicle: vehicleState({ routeHash: 'b'.repeat(64) }),
    });
    await expect(
      incompatible.service.getShipmentScenario(DEMO_SHIPMENT_ID),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not substitute newer LIVE state and rejects stale writes', async () => {
    const live = createService({ selectedWarning: warning('LIVE') });
    await expect(
      live.service.getShipmentScenario(DEMO_SHIPMENT_ID),
    ).rejects.toBeInstanceOf(ConflictException);

    const stale = createService({ updateResult: undefined });
    stale.vehicles.updatePositionIfRevision.mockResolvedValue(undefined);
    await expect(
      stale.service.setVehiclePosition(DEMO_SHIPMENT_ID, {
        position: 'START',
        expectedRevision: 0,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not expose other shipments through the demo endpoint', async () => {
    const { service } = createService();

    await expect(service.getShipmentScenario('SHP-001')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
