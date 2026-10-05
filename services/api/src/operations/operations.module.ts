import { Module } from '@nestjs/common';
import { DemoModule } from '../demo/demo.module';
import { DisruptionModule } from '../disruption/disruption.module';
import { ShipmentModule } from '../shipment/shipment.module';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';

@Module({
  imports: [DemoModule, DisruptionModule, ShipmentModule],
  controllers: [OperationsController],
  providers: [OperationsService],
})
export class OperationsModule {}
