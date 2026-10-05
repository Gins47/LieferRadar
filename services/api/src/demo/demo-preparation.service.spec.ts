import {
  DEMO_SHIPMENT_ID,
  DEMO_START_AT,
  DEMO_VEHICLE_ID,
  DemoPreparationService,
  SELECTED_WARNING_PROVIDER_ID,
  SELECTED_WARNING_SOURCE,
} from './demo-preparation.service';
import { DemoVehicleState } from './model/demo-vehicle-state.model';

const routeHash = 'a'.repeat(64);
const position: [number, number] = [10.1, 53.7];

function vehicleState(): DemoVehicleState {
  return {
    vehicleId: DEMO_VEHICLE_ID,
    driver: {
      name: 'Alex Demo',
      email: 'driver-shp002@example.invalid',
      phone: '+49 000 0000002',
    },
    routeHash,
    elapsedSeconds: 0,
    position,
    simulatedAt: DEMO_START_AT,
    revision: 0,
    updatedAt: new Date('2026-10-05T08:00:00.000Z'),
  };
}

function warning(ingestionMode: 'LIVE' | 'REPLAY') {
  return {
    id: 'warning-1',
    source: SELECTED_WARNING_SOURCE,
    providerId: SELECTED_WARNING_PROVIDER_ID,
    ingestionMode,
  };
}

describe('DemoPreparationService', () => {
  function createService(
    options: {
      selectedWarning?: ReturnType<typeof warning>;
      existingVehicle?: DemoVehicleState;
      assignedVehicle?: DemoVehicleState;
    } = {},
  ) {
    const autobahnCollection = { replayWarnings: jest.fn() };
    const disruptions = {
      findByProviderIdentity: jest
        .fn()
        .mockResolvedValue(options.selectedWarning),
    };
    const vehicles = {
      findByVehicleId: jest.fn().mockResolvedValue(options.existingVehicle),
      create: jest.fn().mockResolvedValue(vehicleState()),
      findByShipmentId: jest.fn().mockResolvedValue(options.assignedVehicle),
      assignShipment: jest.fn(),
    };
    const route = {
      getRoute: () => ({ routeHash }),
      positionAtElapsedSeconds: () => position,
    };

    return {
      service: new DemoPreparationService(
        autobahnCollection as never,
        disruptions as never,
        vehicles as never,
        route as never,
      ),
      autobahnCollection,
      disruptions,
      vehicles,
    };
  }

  it('prepares SHP-002 before replaying and verifying the exact historical warning', async () => {
    const { service, autobahnCollection, disruptions, vehicles } =
      createService({ selectedWarning: warning('REPLAY') });

    await expect(service.prepare()).resolves.toMatchObject({
      vehicle: vehicleState(),
      warning: warning('REPLAY'),
    });
    expect(autobahnCollection.replayWarnings).toHaveBeenCalledWith(
      'A1',
      expect.any(Array),
      new Date('2026-10-03T07:00:00.000Z'),
    );
    expect(disruptions.findByProviderIdentity).toHaveBeenCalledWith(
      SELECTED_WARNING_SOURCE,
      SELECTED_WARNING_PROVIDER_ID,
    );
    expect(vehicles.create).toHaveBeenCalledWith(
      expect.objectContaining({
        vehicleId: DEMO_VEHICLE_ID,
        elapsedSeconds: 0,
        simulatedAt: DEMO_START_AT,
        revision: 0,
      }),
    );
    expect(vehicles.assignShipment).toHaveBeenCalledWith({
      shipmentId: DEMO_SHIPMENT_ID,
      vehicleId: DEMO_VEHICLE_ID,
    });
  });

  it('fails when the exact historical warning was not persisted', async () => {
    const { service, vehicles } = createService();

    await expect(service.prepare()).rejects.toThrow(
      'selected historical replay warning was not persisted',
    );
    expect(vehicles.create).toHaveBeenCalled();
  });

  it('fails rather than substituting newer LIVE state', async () => {
    const { service, vehicles } = createService({
      selectedWarning: warning('LIVE'),
    });

    await expect(service.prepare()).rejects.toThrow(
      'selected historical replay warning is unavailable because newer LIVE state is persisted',
    );
    expect(vehicles.create).toHaveBeenCalled();
  });

  it('preserves an existing approved vehicle position and revision', async () => {
    const progressedVehicle = {
      ...vehicleState(),
      elapsedSeconds: 600,
      position: [10.5, 53.7] as [number, number],
      simulatedAt: new Date('2026-10-03T06:40:00.000Z'),
      revision: 1,
    };
    const { service, vehicles } = createService({
      selectedWarning: warning('REPLAY'),
      existingVehicle: progressedVehicle,
      assignedVehicle: progressedVehicle,
    });

    await expect(service.prepare()).resolves.toMatchObject({
      vehicle: progressedVehicle,
    });
    expect(vehicles.create).not.toHaveBeenCalled();
    expect(vehicles.assignShipment).not.toHaveBeenCalled();
  });
});
