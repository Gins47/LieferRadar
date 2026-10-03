import { createHash } from 'node:crypto';
import {
  Disruption,
  JsonObject,
  JsonValue,
  ProviderTimestamp,
} from './disruption.model';

type CanonicalJsonValue =
  boolean | null | number | string | CanonicalJsonObject | CanonicalJsonValue[];

interface CanonicalJsonObject {
  [key: string]: CanonicalJsonValue;
}

interface HashableDisruptionContent {
  category: string;
  disruptionType: string;
  queriedRoad: string;
  title: string;
  subtitle: string | null;
  description: readonly JsonValue[];
  startTimestamp: ProviderTimestamp;
  endTimestamp: ProviderTimestamp;
  future: boolean | null;
  abnormalTrafficType: string | null;
  delayMinutes: number | null;
  averageSpeedKmh: number | null;
  coordinate: JsonValue | null;
  geometry: JsonValue | null;
}

function canonicalizeJson(value: JsonValue): CanonicalJsonValue {
  if (Array.isArray(value)) {
    return value.map(canonicalizeJson);
  }

  if (value !== null && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce<CanonicalJsonObject>((canonical, key) => {
        canonical[key] = canonicalizeJson((value as JsonObject)[key]);
        return canonical;
      }, {});
  }

  return value;
}

function canonicalizeProviderTimestamp(
  timestamp: ProviderTimestamp,
): CanonicalJsonObject {
  if (timestamp.kind === 'value') {
    return { kind: timestamp.kind, value: timestamp.value.toISOString() };
  }

  return { kind: timestamp.kind };
}

function selectHashableContent(
  disruption: Disruption,
): HashableDisruptionContent {
  return {
    category: disruption.category,
    disruptionType: disruption.disruptionType,
    queriedRoad: disruption.queriedRoad,
    title: disruption.title,
    subtitle: disruption.subtitle,
    description: disruption.description,
    startTimestamp: disruption.startTimestamp,
    endTimestamp: disruption.endTimestamp,
    future: disruption.future,
    abnormalTrafficType: disruption.abnormalTrafficType,
    delayMinutes: disruption.delayMinutes,
    averageSpeedKmh: disruption.averageSpeedKmh,
    coordinate: disruption.coordinate,
    geometry: disruption.geometry,
  };
}

export function calculateDisruptionContentHash(disruption: Disruption): string {
  const content = selectHashableContent(disruption);
  const canonicalContent = {
    ...content,
    description: canonicalizeJson(content.description),
    startTimestamp: canonicalizeProviderTimestamp(content.startTimestamp),
    endTimestamp: canonicalizeProviderTimestamp(content.endTimestamp),
    coordinate:
      content.coordinate === null ? null : canonicalizeJson(content.coordinate),
    geometry:
      content.geometry === null ? null : canonicalizeJson(content.geometry),
  };

  return createHash('sha256')
    .update(JSON.stringify(canonicalContent))
    .digest('hex');
}
