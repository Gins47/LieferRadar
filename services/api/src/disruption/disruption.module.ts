import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { DisruptionController } from './disruption.controller';
import { DisruptionService } from './disruption.service';
import { PostgresDisruptionRepository } from './repository/postgres-disruption.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [DisruptionController],
  providers: [PostgresDisruptionRepository, DisruptionService],
  exports: [PostgresDisruptionRepository, DisruptionService],
})
export class DisruptionModule {}
