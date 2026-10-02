import {
  ArgumentMetadata,
  BadRequestException,
  PipeTransform,
} from '@nestjs/common';
import { ZodType } from 'zod';

export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: any, metadata: ArgumentMetadata) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const formattedError = result.error.issues.map((issue) => {
        return {
          field: issue.path.join('.'),
          message: issue.message,
        };
      });

      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        errors: formattedError,
      });
    }
    return result.data;
  }
}
