import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ZodValidationPipe } from '../common/pipes/zod-body-validation.pipe';
import {
  createShipmentSchema,
  type CreateShipmentRequest,
} from './create-shipment.dto';
import { ShipmentService } from './shipment.service';

@Controller('shipments')
export class ShipmentController {
  constructor(private readonly shipmentService: ShipmentService) {}

  @Post()
  createShipment(
    @Body(new ZodValidationPipe(createShipmentSchema))
    request: CreateShipmentRequest,
  ) {
    return this.shipmentService.createShipment(request);
  }

  @Get(':id')
  getShipment(@Param('id') id: string) {
    return this.shipmentService.getShipment(id);
  }
}
