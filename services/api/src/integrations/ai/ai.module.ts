import { Module } from '@nestjs/common';
import { DisruptionAssessmentClient } from './disruption-assessment.client';

@Module({
  providers: [DisruptionAssessmentClient],
  exports: [DisruptionAssessmentClient],
})
export class AiModule {}
