import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { DisruptionModule } from '../disruption/disruption.module';
import { AutobahnModule } from '../integrations/autobahn/autobahn.module';
import { ShipmentModule } from '../shipment/shipment.module';
import { DemoController } from './demo.controller';
import { DemoPreparationService } from './demo-preparation.service';
import { DemoService } from './demo.service';
import { PostgresDemoVehicleRepository } from './repository/postgres-demo-vehicle.repository';
import { LuebeckHamburgRouteService } from './route/luebeck-hamburg-route.service';

@Module({
  imports: [AutobahnModule, DatabaseModule, DisruptionModule, ShipmentModule],
  controllers: [DemoController],
  providers: [
    DemoPreparationService,
    DemoService,
    PostgresDemoVehicleRepository,
    LuebeckHamburgRouteService,
  ],
  exports: [DemoPreparationService],
})
export class DemoModule {}
