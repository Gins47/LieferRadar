import { Controller, Get, Param } from '@nestjs/common';
import { ShipmentService } from './shipment.service';

@Controller('shipments')
export class ShipmentController {
  constructor(private readonly shipmentService: ShipmentService) {}

  @Get(':id')
  getShipment(@Param('id') id: string) {
    return this.shipmentService.getShipment(id);
  }
}
