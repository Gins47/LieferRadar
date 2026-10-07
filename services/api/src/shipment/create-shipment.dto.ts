import { z } from 'zod';

const motorwaySchema = z
  .string()
  .trim()
  .regex(/^A\d{1,3}[a-z]?$/i, 'must be a motorway identifier such as A1')
  .transform((value) => value.toUpperCase());

const locationSchema = z
  .object({
    city: z.string().trim().min(1).max(120),
    countryCode: z
      .string()
      .trim()
      .regex(/^[a-z]{2}$/i, 'must be a two-letter country code')
      .transform((value) => value.toUpperCase()),
    latitude: z.number().finite().min(-90).max(90).optional(),
    longitude: z.number().finite().min(-180).max(180).optional(),
  })
  .strict();

const isoInstantSchema = z.string().datetime({ offset: true });

export const createShipmentSchema = z
  .object({
    supplierId: z.string().trim().min(1).max(100),
    productId: z.string().trim().min(1).max(100),
    quantity: z.number().int().positive(),
    pickupLocation: locationSchema,
    destination: locationSchema,
    plannedRoute: z.array(motorwaySchema).min(1).max(20),
    pickupAt: isoInstantSchema,
    plannedDeliveryAt: isoInstantSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (new Date(value.plannedDeliveryAt) <= new Date(value.pickupAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['plannedDeliveryAt'],
        message: 'must be after pickupAt',
      });
    }
  });

export type CreateShipmentRequest = z.infer<typeof createShipmentSchema>;
