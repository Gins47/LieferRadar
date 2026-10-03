import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseModule } from '../src/database/database.module';
import { DatabaseService } from '../src/database/database.service';
import { getTestDatabaseUrl } from './database-test-context';

describe('ephemeral PostgreSQL integration database', () => {
  it('connects through the runner-owned database service', async () => {
    getTestDatabaseUrl();
    const module: TestingModule = await Test.createTestingModule({
      imports: [DatabaseModule],
    }).compile();
    const database = module.get(DatabaseService);

    try {
      await expect(database.verifyConnection()).resolves.toBeUndefined();
    } finally {
      await module.close();
    }
  });
});
