import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { DisruptionModule } from '../disruption/disruption.module';
import { AutobahnModule } from '../integrations/autobahn/autobahn.module';
import { DemoPreparationService } from './demo-preparation.service';
import { PostgresDemoVehicleRepository } from './repository/postgres-demo-vehicle.repository';
import { LuebeckHamburgRouteService } from './route/luebeck-hamburg-route.service';

@Module({
  imports: [AutobahnModule, DatabaseModule, DisruptionModule],
  providers: [
    DemoPreparationService,
    PostgresDemoVehicleRepository,
    LuebeckHamburgRouteService,
  ],
  exports: [DemoPreparationService],
})
export class DemoModule {}
