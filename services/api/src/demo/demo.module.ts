import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { DisruptionModule } from '../disruption/disruption.module';
import { AutobahnModule } from '../integrations/autobahn/autobahn.module';
import { AiModule } from '../integrations/ai/ai.module';
import { ShipmentModule } from '../shipment/shipment.module';
import { DemoAssessmentService } from './demo-assessment.service';
import { DemoController } from './demo.controller';
import { DemoEvidenceService } from './demo-evidence.service';
import { DemoPreparationService } from './demo-preparation.service';
import { DemoService } from './demo.service';
import { PostgresDemoVehicleRepository } from './repository/postgres-demo-vehicle.repository';
import { LuebeckHamburgRouteService } from './route/luebeck-hamburg-route.service';

@Module({
  imports: [
    AiModule,
    AutobahnModule,
    DatabaseModule,
    DisruptionModule,
    ShipmentModule,
  ],
  controllers: [DemoController],
  providers: [
    DemoPreparationService,
    DemoService,
    DemoEvidenceService,
    DemoAssessmentService,
    PostgresDemoVehicleRepository,
    LuebeckHamburgRouteService,
  ],
  exports: [DemoPreparationService, DemoService],
})
export class DemoModule {}
