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

async function getLogisticsTables(client: Client) {
  return client.query<{
    suppliers: string | null;
    products: string | null;
    shipments: string | null;
  }>(
    `SELECT
      to_regclass('public.suppliers') AS suppliers,
      to_regclass('public.products') AS products,
      to_regclass('public.shipments') AS shipments`,
  );
}

describe('logistics schema migration', () => {
  let client: Client;

  beforeEach(async () => {
    client = await createClient();
  });

  afterEach(async () => {
    await client.end();
  });

  it('creates the logistics tables', async () => {
    const tables = await getLogisticsTables(client);

    expect(tables.rows[0]).toEqual({
      suppliers: 'suppliers',
      products: 'products',
      shipments: 'shipments',
    });
  });

  it('rolls back and reapplies the migration before the test completes', async () => {
    const databaseUrl = getTestDatabaseUrl();
    let rolledBack = false;

    try {
      await runMigration('down', databaseUrl);
      rolledBack = true;

      const tablesAfterRollback = await getLogisticsTables(client);
      expect(tablesAfterRollback.rows[0]).toEqual({
        suppliers: null,
        products: null,
        shipments: null,
      });
    } finally {
      if (rolledBack) {
        await runMigration('up', databaseUrl);
      }
    }

    const tablesAfterReapplication = await getLogisticsTables(client);
    expect(tablesAfterReapplication.rows[0]).toEqual({
      suppliers: 'suppliers',
      products: 'products',
      shipments: 'shipments',
    });
  });
});
