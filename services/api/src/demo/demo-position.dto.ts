import { z } from 'zod';

export const demoVehiclePositionSchema = z
  .object({
    position: z.enum(['START', 'NEAR_DISRUPTION']),
    expectedRevision: z.number().int().nonnegative(),
  })
  .strict();

export type DemoVehiclePositionRequest = z.infer<
  typeof demoVehiclePositionSchema
>;
