import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProductModule } from './product/product.module';
import { ShipmentModule } from './shipment/shipment.module';
import { SupplierModule } from './supplier/supplier.module';

@Module({
  imports: [SupplierModule, ProductModule, ShipmentModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
