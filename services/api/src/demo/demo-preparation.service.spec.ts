import {
  DEMO_SHIPMENT_003_ID,
  DEMO_SHIPMENT_004_ID,
  DEMO_SHIPMENT_ID,
  DEMO_START_AT,
  DEMO_VEHICLE_003_ID,
  DEMO_VEHICLE_004_ID,
  DEMO_VEHICLE_ID,
  DemoPreparationService,
  SELECTED_WARNING_PROVIDER_ID,
  SELECTED_WARNING_SOURCE,
  SHIPMENT_003_ELAPSED_SECONDS,
} from './demo-preparation.service';
import {
  DemoVehicleState,
  NewDemoVehicleState,
} from './model/demo-vehicle-state.model';

const routeHash = 'a'.repeat(64);

function vehicleState(state: NewDemoVehicleState): DemoVehicleState {
  return {
    ...state,
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
      existingVehicles?: readonly DemoVehicleState[];
      assignedVehicles?: ReadonlyMap<string, DemoVehicleState>;
    } = {},
  ) {
    const existingVehicles = new Map(
      options.existingVehicles?.map((vehicle) => [vehicle.vehicleId, vehicle]),
    );
    const assignedVehicles = new Map(options.assignedVehicles);
    const autobahnCollection = { replayWarnings: jest.fn() };
    const disruptions = {
      findByProviderIdentity: jest
        .fn()
        .mockResolvedValue(options.selectedWarning),
    };
    const vehicles = {
      findByVehicleId: jest.fn((vehicleId: string) =>
        Promise.resolve(existingVehicles.get(vehicleId)),
      ),
      create: jest.fn((state: NewDemoVehicleState) =>
        Promise.resolve(vehicleState(state)),
      ),
      findByShipmentId: jest.fn((shipmentId: string) =>
        Promise.resolve(assignedVehicles.get(shipmentId)),
      ),
      assignShipment: jest.fn(),
    };
    const route = {
      getRoute: () => ({ routeHash }),
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
      route,
    };
  }

  it('prepares independent route-derived contexts before replaying and verifying the exact historical warning', async () => {
    const { service, autobahnCollection, disruptions, vehicles } =
      createService({ selectedWarning: warning('REPLAY') });

    await expect(service.prepare()).resolves.toMatchObject({
      vehicle: {
        vehicleId: DEMO_VEHICLE_ID,
        elapsedSeconds: 0,
        simulatedAt: DEMO_START_AT,
        revision: 0,
      },
      vehicles: [
        { vehicleId: DEMO_VEHICLE_ID },
        {
          vehicleId: DEMO_VEHICLE_003_ID,
          elapsedSeconds: SHIPMENT_003_ELAPSED_SECONDS,
          position: [10.236442, 53.620842],
          simulatedAt: new Date('2026-10-03T07:53:24.000Z'),
        },
        {
          vehicleId: DEMO_VEHICLE_004_ID,
          elapsedSeconds: 0,
          position: [10.686606, 53.865509],
          simulatedAt: DEMO_START_AT,
        },
      ],
      warning: warning('REPLAY'),
    });
    expect(vehicles.assignShipment).toHaveBeenCalledTimes(3);
    expect(vehicles.assignShipment).toHaveBeenCalledWith({
      shipmentId: DEMO_SHIPMENT_ID,
      vehicleId: DEMO_VEHICLE_ID,
    });
    expect(vehicles.assignShipment).toHaveBeenCalledWith({
      shipmentId: DEMO_SHIPMENT_003_ID,
      vehicleId: DEMO_VEHICLE_003_ID,
    });
    expect(vehicles.assignShipment).toHaveBeenCalledWith({
      shipmentId: DEMO_SHIPMENT_004_ID,
      vehicleId: DEMO_VEHICLE_004_ID,
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
  });

  it('fails when the exact historical warning was not persisted', async () => {
    const { service, vehicles } = createService();

    await expect(service.prepare()).rejects.toThrow(
      'selected historical replay warning was not persisted',
    );
    expect(vehicles.create).toHaveBeenCalledTimes(3);
  });

  it('fails rather than substituting newer LIVE state', async () => {
    const { service, vehicles } = createService({
      selectedWarning: warning('LIVE'),
    });

    await expect(service.prepare()).rejects.toThrow(
      'selected historical replay warning is unavailable because newer LIVE state is persisted',
    );
    expect(vehicles.create).toHaveBeenCalledTimes(3);
  });

  it('preserves the existing SHP-002 vehicle position and revision', async () => {
    const progressedVehicle = vehicleState({
      vehicleId: DEMO_VEHICLE_ID,
      driver: {
        name: 'Alex Demo',
        email: 'driver-shp002@example.invalid',
        phone: '+49 000 0000002',
      },
      routeHash,
      elapsedSeconds: 3_840,
      position: [10.3268633226, 53.7010487001],
      simulatedAt: new Date('2026-10-03T07:34:00.000Z'),
      revision: 1,
    });
    const { service, vehicles } = createService({
      selectedWarning: warning('REPLAY'),
      existingVehicles: [progressedVehicle],
      assignedVehicles: new Map([[DEMO_SHIPMENT_ID, progressedVehicle]]),
    });

    await expect(service.prepare()).resolves.toMatchObject({
      vehicle: progressedVehicle,
    });
    expect(vehicles.create).toHaveBeenCalledTimes(2);
    expect(vehicles.assignShipment).toHaveBeenCalledTimes(2);
  });
});
