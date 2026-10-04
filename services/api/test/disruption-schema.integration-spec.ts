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

async function getTables(client: Client) {
  return client.query<{
    disruptions: string | null;
    suppliers: string | null;
    products: string | null;
    shipments: string | null;
  }>(
    `SELECT
      to_regclass('public.disruptions') AS disruptions,
      to_regclass('public.suppliers') AS suppliers,
      to_regclass('public.products') AS products,
      to_regclass('public.shipments') AS shipments`,
  );
}

describe('disruption schema migration', () => {
  let client: Client;

  beforeEach(async () => {
    client = await createClient();
  });

  afterEach(async () => {
    await client.end();
  });

  it('creates the disruption table alongside logistics tables', async () => {
    const tables = await getTables(client);

    expect(tables.rows[0]).toEqual({
      disruptions: 'disruptions',
      suppliers: 'suppliers',
      products: 'products',
      shipments: 'shipments',
    });
  });

  it('rolls back and reapplies the disruption migration safely', async () => {
    const databaseUrl = getTestDatabaseUrl();
    let demoVehicleMigrationRolledBack = false;
    let disruptionMigrationRolledBack = false;

    try {
      await runMigration('down', databaseUrl);
      demoVehicleMigrationRolledBack = true;

      await runMigration('down', databaseUrl);
      disruptionMigrationRolledBack = true;

      expect((await getTables(client)).rows[0]).toEqual({
        disruptions: null,
        suppliers: 'suppliers',
        products: 'products',
        shipments: 'shipments',
      });
    } finally {
      if (disruptionMigrationRolledBack) {
        await runMigration('up', databaseUrl);
      }

      if (demoVehicleMigrationRolledBack) {
        await runMigration('up', databaseUrl);
      }
    }

    expect((await getTables(client)).rows[0]).toEqual({
      disruptions: 'disruptions',
      suppliers: 'suppliers',
      products: 'products',
      shipments: 'shipments',
    });
  });
});
