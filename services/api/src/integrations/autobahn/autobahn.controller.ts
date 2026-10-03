import {
  BadGatewayException,
  Body,
  Controller,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod-body-validation.pipe';
import { AutobahnCollectionService } from './autobahn-collection.service';
import { AutobahnProviderError } from './autobahn.client';

const collectWarningsSchema = z
  .object({
    road: z
      .string()
      .trim()
      .regex(/^A\d{1,3}[a-z]?$/i, 'must be a motorway identifier such as A1')
      .transform((value) => value.toUpperCase())
      .default('A1'),
  })
  .strict();

function collectionEnabled(): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    process.env.AUTOBANH_COLLECTION_ENABLED === 'true'
  );
}

@Controller('integrations/autobahn')
export class AutobahnController {
  constructor(private readonly collectionService: AutobahnCollectionService) {}

  @Post('collect')
  async collectWarnings(
    @Body(new ZodValidationPipe(collectWarningsSchema))
    request: {
      road: string;
    },
  ) {
    if (!collectionEnabled()) {
      throw new NotFoundException();
    }

    try {
      return await this.collectionService.collectWarnings(request.road);
    } catch (error) {
      if (error instanceof AutobahnProviderError) {
        throw new BadGatewayException(error.message);
      }
      throw error;
    }
  }
}
