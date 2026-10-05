import { Module } from '@nestjs/common';
import { LogisticsModule } from '../logistics/logistics.module';
import { ShipmentController } from './shipment.controller';
import { ShipmentService } from './shipment.service';

@Module({
  imports: [LogisticsModule],
  controllers: [ShipmentController],
  providers: [ShipmentService],
  exports: [ShipmentService],
})
export class ShipmentModule {}
