import { z } from 'zod';

export const demoAssessmentSchema = z
  .object({ expectedRevision: z.number().int().nonnegative() })
  .strict();

export type DemoAssessmentRequest = z.infer<typeof demoAssessmentSchema>;
