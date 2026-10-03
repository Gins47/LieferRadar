import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, QueryResult, QueryResultRow } from 'pg';
import { getDatabaseUrl } from './database.config';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool = new Pool({
    connectionString: getDatabaseUrl(),
    connectionTimeoutMillis: 5_000,
  });

  async verifyConnection(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  async query<T extends QueryResultRow>(
    text: string,
    values: unknown[] = [],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, values);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
