import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { LOGISTICS_REPOSITORY } from './repository/logistics-repository';
import { PostgresLogisticsRepository } from './repository/postgres-logistics.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    PostgresLogisticsRepository,
    {
      provide: LOGISTICS_REPOSITORY,
      useExisting: PostgresLogisticsRepository,
    },
  ],
  exports: [LOGISTICS_REPOSITORY],
})
export class LogisticsModule {}
