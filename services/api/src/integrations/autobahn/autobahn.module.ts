import { Module } from '@nestjs/common';
import { DisruptionModule } from '../../disruption/disruption.module';
import { AutobahnClient } from './autobahn.client';
import { AutobahnCollectionService } from './autobahn-collection.service';
import { AutobahnController } from './autobahn.controller';

@Module({
  imports: [DisruptionModule],
  controllers: [AutobahnController],
  providers: [AutobahnClient, AutobahnCollectionService],
})
export class AutobahnModule {}
