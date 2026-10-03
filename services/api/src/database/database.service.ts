import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { getDatabaseUrl } from './database.config';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool = new Pool({ connectionString: getDatabaseUrl() });

  async verifyConnection(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
