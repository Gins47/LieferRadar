export type JsonPrimitive = boolean | null | number | string;

export type JsonValue = JsonObject | JsonPrimitive | readonly JsonValue[];

export interface JsonObject {
  readonly [key: string]: JsonValue;
}

export type ProviderTimestamp =
  | { kind: 'omitted' }
  | { kind: 'explicit-null' }
  | { kind: 'value'; value: Date };

export type DisruptionLifecycleStatus = 'ACTIVE' | 'RESOLVED';

export type DisruptionIngestionMode = 'LIVE' | 'REPLAY';

export interface Disruption {
  id: string;
  source: string;
  providerId: string;
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
  rawData: JsonObject;
  contentHash: string;
  lifecycleStatus: DisruptionLifecycleStatus;
  resolvedAt: Date | null;
  ingestionMode: DisruptionIngestionMode;
  capturedAt: Date;
  lastSeenAt: Date;
  lastLiveSeenAt: Date | null;
  contentChangedAt: Date;
}
