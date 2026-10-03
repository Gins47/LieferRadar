import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  Disruption,
  JsonObject,
  JsonValue,
  ProviderTimestamp,
} from '../../disruption/model/disruption.model';

const autobahnWarningSchema = z
  .object({
    identifier: z.string().trim().min(1),
    display_type: z.string().trim().min(1),
    title: z.string(),
    subtitle: z.string().nullable().optional(),
    description: z.array(z.string()),
    startTimestamp: z.string().nullable().optional(),
    endTimestamp: z.string().nullable().optional(),
    future: z.boolean().nullable().optional(),
    abnormalTrafficType: z.string().nullable().optional(),
    delayTimeValue: z.union([z.string(), z.number(), z.null()]).optional(),
    averageSpeed: z.union([z.string(), z.number(), z.null()]).optional(),
    coordinate: z
      .object({ lat: z.number(), long: z.number() })
      .nullable()
      .optional(),
    geometry: z.unknown().nullable().optional(),
  })
  .passthrough();

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'string'
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return Object.values(value).every(isJsonValue);
}

function asJsonObject(value: unknown): JsonObject {
  if (Array.isArray(value) || typeof value !== 'object' || value === null) {
    throw new Error('Autobahn warning must be a JSON object');
  }
  if (!isJsonValue(value)) {
    throw new Error('Autobahn warning contains a non-JSON value');
  }

  return value as JsonObject;
}

function providerTimestamp(
  warning: Record<string, unknown>,
  field: 'startTimestamp' | 'endTimestamp',
): ProviderTimestamp {
  if (!(field in warning)) {
    return { kind: 'omitted' };
  }

  const value = warning[field];
  if (value === null) {
    return { kind: 'explicit-null' };
  }
  if (typeof value !== 'string') {
    throw new Error(`${field} must be a timestamp string or null`);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${field} must be a valid timestamp`);
  }

  return { kind: 'value', value: parsed };
}

function optionalInteger(value: unknown, field: string): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^-?\d+$/.test(value)
        ? Number(value)
        : Number.NaN;
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${field} must be an integer when supplied`);
  }

  return parsed;
}

export function normalizeAutobahnWarning(
  rawWarning: unknown,
  queriedRoad: string,
  observedAt: Date,
  ingestionMode: Disruption['ingestionMode'] = 'LIVE',
): Disruption {
  const rawData = asJsonObject(rawWarning);
  const warning = autobahnWarningSchema.parse(rawData);
  const record = warning as Record<string, unknown>;

  return {
    id: randomUUID(),
    source: 'autobahn',
    providerId: warning.identifier,
    category: 'WARNING',
    disruptionType: warning.abnormalTrafficType ?? warning.display_type,
    queriedRoad,
    title: warning.title,
    subtitle: warning.subtitle ?? null,
    description: warning.description,
    startTimestamp: providerTimestamp(record, 'startTimestamp'),
    endTimestamp: providerTimestamp(record, 'endTimestamp'),
    future: warning.future ?? null,
    abnormalTrafficType: warning.abnormalTrafficType ?? null,
    delayMinutes: optionalInteger(warning.delayTimeValue, 'delayTimeValue'),
    averageSpeedKmh: optionalInteger(warning.averageSpeed, 'averageSpeed'),
    coordinate: warning.coordinate ?? null,
    geometry:
      warning.geometry === undefined ? null : (warning.geometry as JsonValue),
    rawData,
    contentHash: '',
    lifecycleStatus: 'ACTIVE',
    resolvedAt: null,
    ingestionMode,
    capturedAt: observedAt,
    lastSeenAt: observedAt,
    lastLiveSeenAt: ingestionMode === 'LIVE' ? observedAt : null,
    contentChangedAt: observedAt,
  };
}
