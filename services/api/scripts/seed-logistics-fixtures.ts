import { Client } from 'pg';
import {
  assertLocalDevelopmentCommandAllowed,
  getLocalDevelopmentDatabaseUrl,
} from '../src/database/local-development-database';
import { seedLogisticsFixtures } from '../src/logistics/repository/logistics-fixture-seed';

async function main(): Promise<void> {
  if (process.argv[2] !== '--development') {
    throw new Error(
      'logistics fixture seeding requires the --development flag',
    );
  }
  assertLocalDevelopmentCommandAllowed('logistics fixture seeding');
  const client = new Client({
    connectionString: getLocalDevelopmentDatabaseUrl(
      'logistics fixture seeding',
    ),
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
