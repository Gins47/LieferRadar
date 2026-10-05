import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { ZodValidationPipe } from '../common/pipes/zod-body-validation.pipe';
import { demoVehiclePositionSchema } from './demo-position.dto';
import type { DemoVehiclePositionRequest } from './demo-position.dto';
import { DemoService } from './demo.service';

function demoControlsEnabled(): boolean {
  return (
    process.env.NODE_ENV === 'development' &&
    process.env.LIEFERRADAR_DEMO_CONTROLS_ENABLED === 'true'
  );
}

@Controller('demo/shipments')
export class DemoController {
  constructor(private readonly demo: DemoService) {}

  @Get(':id')
  getShipmentScenario(@Param('id') id: string) {
    return this.demo.getShipmentScenario(id);
  }

  @Post(':id/vehicle-position')
  setVehiclePosition(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(demoVehiclePositionSchema))
    request: DemoVehiclePositionRequest,
  ) {
    if (!demoControlsEnabled()) {
      throw new NotFoundException();
    }

    return this.demo.setVehiclePosition(id, request);
  }
}
