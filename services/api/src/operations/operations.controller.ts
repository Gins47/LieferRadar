import { Controller, Get, Param, Query } from '@nestjs/common';
import { ZodValidationPipe } from '../common/pipes/zod-body-validation.pipe';
import {
  operationsWarningsQuerySchema,
  type OperationsWarningsQuery,
} from './operations-query.dto';
import { OperationsService } from './operations.service';

@Controller('operations')
export class OperationsController {
  constructor(private readonly operations: OperationsService) {}

  @Get('shipments')
  getShipments() {
    return this.operations.getShipments();
  }

  @Get('shipments/:id')
  getShipment(@Param('id') id: string) {
    return this.operations.getShipment(id);
  }

  @Get('warnings')
  getWarnings(
    @Query(new ZodValidationPipe(operationsWarningsQuerySchema))
    query: OperationsWarningsQuery,
  ) {
    return this.operations.getWarnings(query);
  }
}
