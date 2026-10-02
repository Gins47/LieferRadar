import { Module } from '@nestjs/common';
import { InMemoryLogisticsRepository } from './repository/in-memory-logistics.repository';

@Module({
  providers: [InMemoryLogisticsRepository],
  exports: [InMemoryLogisticsRepository],
})
export class LogisticsModule {}
