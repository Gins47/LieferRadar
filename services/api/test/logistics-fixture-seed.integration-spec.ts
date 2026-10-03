import { Client } from 'pg';
import {
  logisticsFixtureProducts,
  logisticsFixtureShipments,
  logisticsFixtureSuppliers,
} from '../src/logistics/repository/logistics-fixtures';
import { seedLogisticsFixtures } from '../src/logistics/repository/logistics-fixture-seed';
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

async function getFixtureSnapshot(client: Client) {
  const suppliers = await client.query<{
    id: string;
    name: string;
    location: { city: string; countryCode: string };
  }>('SELECT id, name, location FROM suppliers ORDER BY id');
  const products = await client.query<{
    id: string;
    sku: string;
    name: string;
  }>('SELECT id, sku, name FROM products ORDER BY id');
  const shipments = await client.query<{
    id: string;
    supplierId: string;
    productId: string;
    quantity: number;
    pickupLocation: { city: string; countryCode: string };
    destination: { city: string; countryCode: string };
    plannedRoute: string[];
    status: string;
    pickupAt: Date;
    plannedDeliveryAt: Date;
  }>(
    `SELECT
      id,
      supplier_id AS "supplierId",
      product_id AS "productId",
      quantity,
      pickup_location AS "pickupLocation",
      destination,
      planned_route AS "plannedRoute",
      status,
      pickup_at AS "pickupAt",
      planned_delivery_at AS "plannedDeliveryAt"
    FROM shipments
    ORDER BY id`,
  );

  return {
    suppliers: suppliers.rows,
    products: products.rows,
    shipments: shipments.rows.map((shipment) => ({
      ...shipment,
      pickupAt: shipment.pickupAt.toISOString(),
      plannedDeliveryAt: shipment.plannedDeliveryAt.toISOString(),
    })),
  };
}

function expectedFixtureSnapshot() {
  return {
    suppliers: logisticsFixtureSuppliers,
    products: logisticsFixtureProducts,
    shipments: logisticsFixtureShipments.map((shipment) => ({
      ...shipment,
      pickupAt: shipment.pickupAt.toISOString(),
      plannedDeliveryAt: shipment.plannedDeliveryAt.toISOString(),
    })),
  };
}

describe('logistics fixture seed', () => {
  let client: Client;

  beforeEach(async () => {
    client = await createClient();
    await clearLogisticsFixtures(client);
  });

  afterEach(async () => {
    await client.end();
  });

  it('seeds the exact logistics fixtures with UTC timestamps', async () => {
    await seedLogisticsFixtures(client);

    expect(await getFixtureSnapshot(client)).toEqual(expectedFixtureSnapshot());
  });

  it('is idempotent when seeded repeatedly', async () => {
    await seedLogisticsFixtures(client);
    await seedLogisticsFixtures(client);

    expect(await getFixtureSnapshot(client)).toEqual(expectedFixtureSnapshot());
  });

  it.each([
    ['regression', 'SUP-001'],
    ['A1 scenario', 'SUP-002'],
  ])(
    'rolls back atomically when the %s fixture group conflicts',
    async (_, id) => {
      const conflictingSupplier = {
        id,
        name: 'Conflicting Supplier',
        location: { city: 'Berlin', countryCode: 'DE' },
      };
      await client.query(
        'INSERT INTO suppliers (id, name, location) VALUES ($1, $2, $3::jsonb)',
        [
          conflictingSupplier.id,
          conflictingSupplier.name,
          JSON.stringify(conflictingSupplier.location),
        ],
      );

      await expect(seedLogisticsFixtures(client)).rejects.toThrow(
        `logistics fixture conflict for supplier ${id}`,
      );
      expect(await getFixtureSnapshot(client)).toEqual({
        suppliers: [conflictingSupplier],
        products: [],
        shipments: [],
      });
    },
  );
});
