import { Controller, Get, Param, Query } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/pipes/zod-body-validation.pipe';
import { ActiveDisruptionQuery } from './repository/disruption-query';
import { DisruptionService } from './disruption.service';

const disruptionIdSchema = z.string().uuid();

const listDisruptionsQuerySchema = z
  .object({
    road: z.string().trim().min(1).optional(),
    category: z.string().trim().min(1).optional(),
    date: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    dateField: z.enum(['startTimestamp', 'capturedAt']).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
  })
  .strict()
  .transform(({ road, ...query }) => ({
    ...query,
    queriedRoad: road,
  }));

@Controller('disruptions')
export class DisruptionController {
  constructor(private readonly disruptionService: DisruptionService) {}

  @Get()
  getActiveDisruptions(
    @Query(new ZodValidationPipe(listDisruptionsQuerySchema))
    query: Partial<ActiveDisruptionQuery>,
  ) {
    return this.disruptionService.getActiveDisruptions(query);
  }

  @Get(':id')
  getDisruption(
    @Param('id', new ZodValidationPipe(disruptionIdSchema)) id: string,
  ) {
    return this.disruptionService.getDisruption(id);
  }
}
