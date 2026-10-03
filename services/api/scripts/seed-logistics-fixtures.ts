import { Client } from 'pg';
import { seedLogisticsFixtures } from '../src/logistics/repository/logistics-fixture-seed';

function getLocalDevelopmentDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for logistics fixture seeding');
  }

  try {
    const url = new URL(databaseUrl);
    const isLocalHost = ['127.0.0.1', 'localhost'].includes(url.hostname);
    const isPostgres = ['postgres:', 'postgresql:'].includes(url.protocol);

    if (
      !isPostgres ||
      !isLocalHost ||
      url.port !== '5432' ||
      url.pathname !== '/lieferrader_db'
    ) {
      throw new Error(
        'logistics fixture seeding requires the local development database',
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('logistics')) {
      throw error;
    }
    throw new Error(
      'logistics fixture seeding requires a valid local development DATABASE_URL',
    );
  }

  return databaseUrl;
}

async function main(): Promise<void> {
  if (process.argv[2] !== '--development') {
    throw new Error(
      'logistics fixture seeding requires the --development flag',
    );
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('logistics fixture seeding is not available in production');
  }
  if (process.env.LIEFERRADAR_TEST_CONTEXT) {
    throw new Error(
      'use integration-test setup to seed an isolated test database',
    );
  }
  const client = new Client({
    connectionString: getLocalDevelopmentDatabaseUrl(),
  });
  await client.connect();

  try {
    await seedLogisticsFixtures(client);
  } finally {
    await client.end();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
