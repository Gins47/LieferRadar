import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import {
  assertLocalDevelopmentCommandAllowed,
  getLocalDevelopmentDatabaseUrl,
} from '../src/database/local-development-database';
import { AutobahnCollectionService } from '../src/integrations/autobahn/autobahn-collection.service';

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
  assertLocalDevelopmentCommandAllowed('Autobahn fixture replay');
  getLocalDevelopmentDatabaseUrl('Autobahn fixture replay');

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
