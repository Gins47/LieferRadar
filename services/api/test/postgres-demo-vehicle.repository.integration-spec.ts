import { Test, TestingModule } from '@nestjs/testing';
import { Client } from 'pg';
import { DatabaseModule } from '../src/database/database.module';
import {
  DemoVehicleState,
  NewDemoVehicleState,
} from '../src/demo/model/demo-vehicle-state.model';
import { PostgresDemoVehicleRepository } from '../src/demo/repository/postgres-demo-vehicle.repository';
import { seedLogisticsFixtures } from '../src/logistics/repository/logistics-fixture-seed';
import { getTestDatabaseUrl } from './database-test-context';

async function createClient(): Promise<Client> {
  const client = new Client({ connectionString: getTestDatabaseUrl() });
  await client.connect();
  return client;
}

function createVehicleState(
  overrides: Partial<NewDemoVehicleState> = {},
): NewDemoVehicleState {
  return {
    vehicleId: 'VEH-DEMO-002',
    driver: {
      name: 'Alex Demo',
      email: 'driver-shp002@example.invalid',
      phone: '+49 000 0000002',
    },
    routeHash: 'e'.repeat(64),
    elapsedSeconds: 600,
    position: [10.5, 53.7],
    simulatedAt: new Date('2026-10-03T06:40:00.000Z'),
    revision: 1,
    ...overrides,
  };
}

function expectPersistedState(
  actual: DemoVehicleState,
  expected: NewDemoVehicleState,
): void {
  const { updatedAt, ...persistedState } = actual;

  expect(persistedState).toEqual(expected);
  expect(updatedAt).toBeInstanceOf(Date);
}

describe('PostgresDemoVehicleRepository', () => {
  let client: Client;
  let module: TestingModule;
  let repository: PostgresDemoVehicleRepository;

  beforeEach(async () => {
    client = await createClient();
    await client.query('DELETE FROM demo_vehicle_shipments');
    await client.query('DELETE FROM demo_vehicle_state');
    await seedLogisticsFixtures(client);

    module = await Test.createTestingModule({
      imports: [DatabaseModule],
      providers: [PostgresDemoVehicleRepository],
    }).compile();
    repository = module.get(PostgresDemoVehicleRepository);
  });

  afterEach(async () => {
    await module.close();
    await client.end();
  });

  it('persists and maps the latest fictional vehicle state', async () => {
    const state = createVehicleState();

    const created = await repository.create(state);

    expectPersistedState(created, state);
    await repository.assignShipment({
      shipmentId: 'SHP-002',
      vehicleId: state.vehicleId,
    });

    await expect(repository.findByVehicleId(state.vehicleId)).resolves.toEqual(
      created,
    );
    await expect(repository.findByShipmentId('SHP-002')).resolves.toEqual(
      created,
    );
  });

  it('associates multiple shipments with one vehicle', async () => {
    const state = await repository.create(createVehicleState());

    await repository.assignShipment({
      shipmentId: 'SHP-001',
      vehicleId: state.vehicleId,
    });
    await repository.assignShipment({
      shipmentId: 'SHP-002',
      vehicleId: state.vehicleId,
    });

    await expect(repository.findByShipmentId('SHP-001')).resolves.toEqual(
      state,
    );
    await expect(repository.findByShipmentId('SHP-002')).resolves.toEqual(
      state,
    );
  });

  it('does not allow a shipment to have two current vehicle assignments', async () => {
    const firstVehicle = await repository.create(createVehicleState());
    const secondVehicle = await repository.create(
      createVehicleState({ vehicleId: 'VEH-DEMO-003' }),
    );

    await repository.assignShipment({
      shipmentId: 'SHP-002',
      vehicleId: firstVehicle.vehicleId,
    });

    await expect(
      repository.assignShipment({
        shipmentId: 'SHP-002',
        vehicleId: secondVehicle.vehicleId,
      }),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('returns undefined for a shipment without demo vehicle state', async () => {
    await expect(
      repository.findByShipmentId('SHP-001'),
    ).resolves.toBeUndefined();
  });

  it('updates the latest position only when the expected revision matches', async () => {
    const created = await repository.create(
      createVehicleState({ revision: 1 }),
    );

    await expect(
      repository.updatePositionIfRevision(created.vehicleId, 1, {
        elapsedSeconds: 3_840,
        position: [10.326863322601533, 53.701048700082],
        simulatedAt: new Date('2026-10-03T07:34:00.000Z'),
      }),
    ).resolves.toMatchObject({
      vehicleId: created.vehicleId,
      elapsedSeconds: 3_840,
      position: [10.326863322601533, 53.701048700082],
      simulatedAt: new Date('2026-10-03T07:34:00.000Z'),
      revision: 2,
    });

    await expect(
      repository.updatePositionIfRevision(created.vehicleId, 1, {
        elapsedSeconds: 0,
        position: [10.686606, 53.865509],
        simulatedAt: new Date('2026-10-03T06:30:00.000Z'),
      }),
    ).resolves.toBeUndefined();
    await expect(
      repository.findByVehicleId(created.vehicleId),
    ).resolves.toMatchObject({
      elapsedSeconds: 3_840,
      revision: 2,
    });
  });
});
