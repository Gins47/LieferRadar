import { existsSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DatabaseService } from './database/database.service';

async function bootstrap() {
  if (
    process.env.NODE_ENV !== 'production' &&
    process.env.NODE_ENV !== 'test' &&
    existsSync('.env')
  ) {
    process.loadEnvFile('.env');
  }

  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  try {
    await app.get(DatabaseService).verifyConnection();
    await app.listen(process.env.PORT ?? 3000);
  } catch (error) {
    await app.close();
    throw error;
  }
}

void bootstrap();
