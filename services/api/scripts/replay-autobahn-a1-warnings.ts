import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AutobahnCollectionService } from '../src/integrations/autobahn/autobahn-collection.service';

function getDemoDatabaseUrl(): string {
  const databaseUrl = process.env.LIEFERRADAR_DEMO_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('LIEFERRADAR_DEMO_DATABASE_URL is required for replay');
  }

  const url = new URL(databaseUrl);
  const isLocalHost = ['127.0.0.1', 'localhost'].includes(url.hostname);
  const isPostgres = ['postgres:', 'postgresql:'].includes(url.protocol);
  const databaseName = url.pathname.slice(1);
  if (
    !isPostgres ||
    !isLocalHost ||
    url.port !== '5432' ||
    !databaseName.startsWith('lieferradar_demo_')
  ) {
    throw new Error(
      'replay requires a local PostgreSQL demo database named lieferradar_demo_*',
    );
  }

  return databaseUrl;
}

function loadWarnings(): unknown[] {
  const fixture = JSON.parse(
    readFileSync(
      join(process.cwd(), 'test/fixtures/autobahn/a1-warnings-2026-10.03.json'),
      'utf8',
    ),
  ) as { warning?: unknown };

  if (!Array.isArray(fixture.warning)) {
    throw new Error('A1 warning fixture does not contain a warning array');
  }

  return fixture.warning;
}

async function main(): Promise<void> {
  if (process.argv[2] !== '--demo') {
    throw new Error('Autobahn fixture replay requires the --demo flag');
  }
  if (
    process.env.NODE_ENV === 'production' ||
    process.env.LIEFERRADAR_TEST_CONTEXT
  ) {
    throw new Error(
      'Autobahn fixture replay is unavailable in this environment',
    );
  }

  process.env.DATABASE_URL = getDemoDatabaseUrl();
  const application = await NestFactory.createApplicationContext(AppModule);

  try {
    const result = await application
      .get(AutobahnCollectionService)
      .replayWarnings(
        'A1',
        loadWarnings(),
        new Date('2026-10-03T07:00:00.000Z'),
      );
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await application.close();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
