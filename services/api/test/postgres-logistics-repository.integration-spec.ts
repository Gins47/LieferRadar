import { Test, TestingModule } from '@nestjs/testing';
import { Client } from 'pg';
import { DatabaseModule } from '../src/database/database.module';
import {
  logisticsFixtureProducts,
  logisticsFixtureShipments,
  logisticsFixtureSuppliers,
} from '../src/logistics/repository/logistics-fixtures';
import {
  LOGISTICS_REPOSITORY,
  LogisticsRepository,
} from '../src/logistics/repository/logistics-repository';
import { seedLogisticsFixtures } from '../src/logistics/repository/logistics-fixture-seed';
import { PostgresLogisticsRepository } from '../src/logistics/repository/postgres-logistics.repository';
import { getTestDatabaseUrl } from './database-test-context';

async function createClient(): Promise<Client> {
  const client = new Client({ connectionString: getTestDatabaseUrl() });
  await client.connect();
  return client;
}

async function clearLogisticsFixtures(client: Client): Promise<void> {
  await client.query('DELETE FROM shipments');
  await client.query('DELETE FROM products');
  await client.query('DELETE FROM suppliers');
}

describe('PostgresLogisticsRepository', () => {
  let client: Client;
  let module: TestingModule;
  let repository: LogisticsRepository;

  beforeEach(async () => {
    client = await createClient();
    await clearLogisticsFixtures(client);
    await seedLogisticsFixtures(client);

    module = await Test.createTestingModule({
      imports: [DatabaseModule],
      providers: [
        PostgresLogisticsRepository,
        {
          provide: LOGISTICS_REPOSITORY,
          useExisting: PostgresLogisticsRepository,
        },
      ],
    }).compile();
    repository = module.get<LogisticsRepository>(LOGISTICS_REPOSITORY);
  });

  afterEach(async () => {
    await module.close();
    await client.end();
  });

  it('maps both fixture shipments and their related records', async () => {
    await expect(repository.findSupplierById('SUP-001')).resolves.toEqual(
      logisticsFixtureSuppliers[0],
    );
    await expect(repository.findSupplierById('SUP-002')).resolves.toEqual(
      logisticsFixtureSuppliers[1],
    );
    await expect(repository.findProductById('PROD-001')).resolves.toEqual(
      logisticsFixtureProducts[0],
    );
    await expect(repository.findShipmentById('SHP-001')).resolves.toEqual(
      logisticsFixtureShipments[0],
    );
    await expect(repository.findShipmentById('SHP-002')).resolves.toEqual(
      logisticsFixtureShipments[1],
    );
  });

  it('maps PostgreSQL timestamps to UTC Date values', async () => {
    const shipment = await repository.findShipmentById('SHP-002');

    expect(shipment?.pickupAt).toBeInstanceOf(Date);
    expect(shipment?.plannedDeliveryAt).toBeInstanceOf(Date);
    expect(shipment?.pickupAt.toISOString()).toBe('2026-10-03T06:30:00.000Z');
    expect(shipment?.plannedDeliveryAt.toISOString()).toBe(
      '2026-10-03T08:30:00.000Z',
    );
  });

  it('returns undefined for missing records', async () => {
    await expect(
      repository.findSupplierById('SUP-MISSING'),
    ).resolves.toBeUndefined();
    await expect(
      repository.findProductById('PROD-MISSING'),
    ).resolves.toBeUndefined();
    await expect(
      repository.findShipmentById('SHP-MISSING'),
    ).resolves.toBeUndefined();
  });

  it('uses lookup values as query parameters', async () => {
    const injectedId = "SHP-001' OR '1' = '1";

    await expect(
      repository.findSupplierById(injectedId),
    ).resolves.toBeUndefined();
    await expect(
      repository.findProductById(injectedId),
    ).resolves.toBeUndefined();
    await expect(
      repository.findShipmentById(injectedId),
    ).resolves.toBeUndefined();
  });
});
