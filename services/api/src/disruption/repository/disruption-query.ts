import { z } from 'zod';
import { Disruption } from '../model/disruption.model';

export const DEFAULT_DISRUPTION_PAGE = 1;
export const DEFAULT_DISRUPTION_LIMIT = 20;
export const MAXIMUM_DISRUPTION_LIMIT = 100;

export type DisruptionDateField = 'startTimestamp' | 'capturedAt';

export interface ActiveDisruptionQuery {
  queriedRoad?: string;
  category?: string;
  date?: string;
  from?: string;
  to?: string;
  dateField: DisruptionDateField;
  page: number;
  limit: number;
}

export interface DisruptionPage {
  items: Disruption[];
  page: number;
  limit: number;
  total: number;
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) {
    return false;
  }

  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

const calendarDateSchema = z
  .string()
  .refine(isCalendarDate, 'must be a valid YYYY-MM-DD calendar date');

const optionalFilterSchema = z.string().trim().min(1).optional();

export const activeDisruptionQuerySchema = z
  .object({
    queriedRoad: optionalFilterSchema,
    category: optionalFilterSchema,
    date: calendarDateSchema.optional(),
    from: calendarDateSchema.optional(),
    to: calendarDateSchema.optional(),
    dateField: z
      .enum(['startTimestamp', 'capturedAt'])
      .default('startTimestamp'),
    page: z.number().int().positive().default(DEFAULT_DISRUPTION_PAGE),
    limit: z
      .number()
      .int()
      .positive()
      .max(MAXIMUM_DISRUPTION_LIMIT)
      .default(DEFAULT_DISRUPTION_LIMIT),
  })
  .strict()
  .superRefine((query, context) => {
    if (query.date && (query.from || query.to)) {
      context.addIssue({
        code: 'custom',
        message: 'date cannot be combined with from or to',
        path: ['date'],
      });
    }

    if (query.from && query.to && query.from > query.to) {
      context.addIssue({
        code: 'custom',
        message: 'from cannot be after to',
        path: ['to'],
      });
    }
  });

export function parseActiveDisruptionQuery(
  value: unknown = {},
): ActiveDisruptionQuery {
  return activeDisruptionQuerySchema.parse(value);
}
