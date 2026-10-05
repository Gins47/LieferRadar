import { Client } from 'pg';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import {
  assertLocalDevelopmentCommandAllowed,
  getLocalDevelopmentDatabaseUrl,
} from '../src/database/local-development-database';
import { DemoPreparationService } from '../src/demo/demo-preparation.service';
import { seedLogisticsFixtures } from '../src/logistics/repository/logistics-fixture-seed';

async function main(): Promise<void> {
  if (process.argv[2] !== '--demo') {
    throw new Error('demo preparation requires the --demo flag');
  }
  assertLocalDevelopmentCommandAllowed('demo preparation');

  const databaseUrl = getLocalDevelopmentDatabaseUrl('demo preparation');
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await seedLogisticsFixtures(client);
  } finally {
    await client.end();
  }

  const application = await NestFactory.createApplicationContext(AppModule);
  try {
    const result = await application.get(DemoPreparationService).prepare();
    process.stdout.write(
      `${JSON.stringify({
        vehicleId: result.vehicle.vehicleId,
        warningId: result.warning.id,
        warningSource: result.warning.source,
        warningProviderId: result.warning.providerId,
        warningIngestionMode: result.warning.ingestionMode,
      })}\n`,
    );
  } finally {
    await application.close();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
