import { Test, TestingModule } from '@nestjs/testing';
import { Client } from 'pg';
import { DemoModule } from '../src/demo/demo.module';
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
} from '../src/demo/demo-preparation.service';
import { seedLogisticsFixtures } from '../src/logistics/repository/logistics-fixture-seed';
import { getTestDatabaseUrl } from './database-test-context';

async function createClient(): Promise<Client> {
  const client = new Client({ connectionString: getTestDatabaseUrl() });
  await client.connect();
  return client;
}

describe('demo preparation', () => {
  let client: Client;
  let module: TestingModule;
  let preparation: DemoPreparationService;

  beforeEach(async () => {
    client = await createClient();
    await client.query('DELETE FROM demo_vehicle_shipments');
    await client.query('DELETE FROM demo_vehicle_state');
    await client.query('DELETE FROM disruptions');
    await client.query('DELETE FROM shipments');
    await client.query('DELETE FROM products');
    await client.query('DELETE FROM suppliers');
    await seedLogisticsFixtures(client);

    module = await Test.createTestingModule({
      imports: [DemoModule],
    }).compile();
    preparation = module.get(DemoPreparationService);
  });

  afterEach(async () => {
    await module?.close();
    await client.end();
  });

  it('persists three independent route-derived vehicle contexts with the exact REPLAY warning', async () => {
    const result = await preparation.prepare();

    expect(result.warning).toMatchObject({
      source: SELECTED_WARNING_SOURCE,
      providerId: SELECTED_WARNING_PROVIDER_ID,
      ingestionMode: 'REPLAY',
    });
    expect(result.vehicle).toMatchObject({
      vehicleId: DEMO_VEHICLE_ID,
      elapsedSeconds: 0,
      simulatedAt: DEMO_START_AT,
      revision: 0,
    });
    expect(result.vehicles).toHaveLength(3);
    const states = await client.query<{
      shipmentId: string;
      vehicleId: string;
      elapsedSeconds: number;
      position: [number, number];
      simulatedAt: Date;
      revision: number;
    }>(
      `SELECT
        demo_vehicle_shipments.shipment_id AS "shipmentId",
        demo_vehicle_state.vehicle_id AS "vehicleId",
        demo_vehicle_state.elapsed_seconds AS "elapsedSeconds",
        demo_vehicle_state.position,
        demo_vehicle_state.simulated_at AS "simulatedAt",
        demo_vehicle_state.revision
      FROM demo_vehicle_shipments
      JOIN demo_vehicle_state ON demo_vehicle_state.vehicle_id = demo_vehicle_shipments.vehicle_id
      WHERE demo_vehicle_shipments.shipment_id = ANY($1::text[])
      ORDER BY demo_vehicle_shipments.shipment_id`,
      [[DEMO_SHIPMENT_ID, DEMO_SHIPMENT_003_ID, DEMO_SHIPMENT_004_ID]],
    );
    expect(states.rows).toEqual([
      {
        shipmentId: DEMO_SHIPMENT_ID,
        vehicleId: DEMO_VEHICLE_ID,
        elapsedSeconds: 0,
        position: [10.686606, 53.865509],
        simulatedAt: DEMO_START_AT,
        revision: 0,
      },
      {
        shipmentId: DEMO_SHIPMENT_003_ID,
        vehicleId: DEMO_VEHICLE_003_ID,
        elapsedSeconds: SHIPMENT_003_ELAPSED_SECONDS,
        position: [10.236442, 53.620842],
        simulatedAt: new Date('2026-10-03T07:53:24.000Z'),
        revision: 0,
      },
      {
        shipmentId: DEMO_SHIPMENT_004_ID,
        vehicleId: DEMO_VEHICLE_004_ID,
        elapsedSeconds: 0,
        position: [10.686606, 53.865509],
        simulatedAt: DEMO_START_AT,
        revision: 0,
      },
    ]);
    await expect(
      client.query(
        'SELECT vehicle_id FROM demo_vehicle_shipments WHERE shipment_id = $1',
        [DEMO_SHIPMENT_ID],
      ),
    ).resolves.toMatchObject({ rows: [{ vehicle_id: DEMO_VEHICLE_ID }] });

    await client.query(
      `UPDATE demo_vehicle_state
       SET elapsed_seconds = $2,
           position = $3::jsonb,
           simulated_at = $4,
           revision = $5
       WHERE vehicle_id = $1`,
      [
        DEMO_VEHICLE_ID,
        600,
        JSON.stringify([10.5, 53.7]),
        new Date('2026-10-03T06:40:00.000Z'),
        1,
      ],
    );

    await expect(preparation.prepare()).resolves.toMatchObject({
      vehicle: {
        ...result.vehicle,
        elapsedSeconds: 600,
        position: [10.5, 53.7],
        simulatedAt: new Date('2026-10-03T06:40:00.000Z'),
        revision: 1,
      },
      warning: result.warning,
    });
    await expect(
      client.query('SELECT count(*)::int AS count FROM demo_vehicle_state'),
    ).resolves.toMatchObject({ rows: [{ count: 3 }] });
    await expect(
      client.query('SELECT count(*)::int AS count FROM demo_vehicle_shipments'),
    ).resolves.toMatchObject({ rows: [{ count: 3 }] });
  });
});
