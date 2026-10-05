import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DisruptionModule } from './disruption/disruption.module';
import { AutobahnModule } from './integrations/autobahn/autobahn.module';
import { DemoModule } from './demo/demo.module';
import { OperationsModule } from './operations/operations.module';
import { ProductModule } from './product/product.module';
import { ShipmentModule } from './shipment/shipment.module';
import { SupplierModule } from './supplier/supplier.module';

@Module({
  imports: [
    SupplierModule,
    ProductModule,
    ShipmentModule,
    DisruptionModule,
    AutobahnModule,
    DemoModule,
    OperationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
