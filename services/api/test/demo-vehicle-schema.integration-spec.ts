import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Client } from 'pg';
import { getTestDatabaseUrl } from './database-test-context';

const execFileAsync = promisify(execFile);

async function createClient(): Promise<Client> {
  const client = new Client({ connectionString: getTestDatabaseUrl() });
  await client.connect();
  return client;
}

async function runMigration(
  direction: 'up' | 'down',
  databaseUrl: string,
): Promise<void> {
  await execFileAsync('npm', ['run', `migrate:${direction}`], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}

async function getDemoVehicleTable(client: Client) {
  return client.query<{
    demoVehicleState: string | null;
    demoVehicleShipments: string | null;
  }>(
    `SELECT
      to_regclass('public.demo_vehicle_state') AS "demoVehicleState",
      to_regclass('public.demo_vehicle_shipments') AS "demoVehicleShipments"`,
  );
}

describe('demo vehicle state schema migration', () => {
  let client: Client;

  beforeEach(async () => {
    client = await createClient();
  });

  afterEach(async () => {
    await client.end();
  });

  it('creates the latest demo vehicle state table', async () => {
    expect((await getDemoVehicleTable(client)).rows[0]).toEqual({
      demoVehicleState: 'demo_vehicle_state',
      demoVehicleShipments: 'demo_vehicle_shipments',
    });
  });

  it('rolls back and reapplies the demo vehicle migration safely', async () => {
    const databaseUrl = getTestDatabaseUrl();
    let rolledBack = false;

    try {
      await runMigration('down', databaseUrl);
      rolledBack = true;

      expect((await getDemoVehicleTable(client)).rows[0]).toEqual({
        demoVehicleState: null,
        demoVehicleShipments: null,
      });
    } finally {
      if (rolledBack) {
        await runMigration('up', databaseUrl);
      }
    }

    expect((await getDemoVehicleTable(client)).rows[0]).toEqual({
      demoVehicleState: 'demo_vehicle_state',
      demoVehicleShipments: 'demo_vehicle_shipments',
    });
  });
});
