import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import { calculateDisruptionContentHash } from '../model/disruption-content-hash';
import {
  Disruption,
  DisruptionIngestionMode,
  DisruptionLifecycleStatus,
  JsonObject,
  JsonValue,
  ProviderTimestamp,
} from '../model/disruption.model';
import {
  ActiveDisruptionQuery,
  DisruptionDateField,
  DisruptionPage,
  parseActiveDisruptionQuery,
} from './disruption-query';

export type DisruptionObservationOutcome = 'NEW' | 'CHANGED' | 'UNCHANGED';

export interface DisruptionObservationResult {
  outcome: DisruptionObservationOutcome;
  disruption: Disruption;
}

interface DisruptionRow {
  id: string;
  source: string;
  providerId: string;
  category: string;
  disruptionType: string;
  queriedRoad: string;
  title: string;
  subtitle: string | null;
  description: JsonValue[];
  startTimestamp: Date | null;
  startTimestampPresent: boolean;
  endTimestamp: Date | null;
  endTimestampPresent: boolean;
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

const SELECT_DISRUPTION_COLUMNS = `
  id,
  source,
  provider_id AS "providerId",
  category,
  disruption_type AS "disruptionType",
  queried_road AS "queriedRoad",
  title,
  subtitle,
  description,
  start_timestamp AS "startTimestamp",
  start_timestamp_present AS "startTimestampPresent",
  end_timestamp AS "endTimestamp",
  end_timestamp_present AS "endTimestampPresent",
  future,
  abnormal_traffic_type AS "abnormalTrafficType",
  delay_minutes AS "delayMinutes",
  average_speed_kmh AS "averageSpeedKmh",
  coordinate,
  geometry,
  raw_data AS "rawData",
  content_hash AS "contentHash",
  lifecycle_status AS "lifecycleStatus",
  resolved_at AS "resolvedAt",
  ingestion_mode AS "ingestionMode",
  captured_at AS "capturedAt",
  last_seen_at AS "lastSeenAt",
  last_live_seen_at AS "lastLiveSeenAt",
  content_changed_at AS "contentChangedAt"`;

const DATE_FIELD_COLUMNS: Record<
  DisruptionDateField,
  'captured_at' | 'start_timestamp'
> = {
  startTimestamp: 'start_timestamp',
  capturedAt: 'captured_at',
};

function mapProviderTimestamp(
  value: Date | null,
  present: boolean,
): ProviderTimestamp {
  if (!present) {
    return { kind: 'omitted' };
  }

  if (value === null) {
    return { kind: 'explicit-null' };
  }

  return { kind: 'value', value };
}

function mapDisruption(row: DisruptionRow): Disruption {
  return {
    id: row.id,
    source: row.source,
    providerId: row.providerId,
    category: row.category,
    disruptionType: row.disruptionType,
    queriedRoad: row.queriedRoad,
    title: row.title,
    subtitle: row.subtitle,
    description: row.description,
    startTimestamp: mapProviderTimestamp(
      row.startTimestamp,
      row.startTimestampPresent,
    ),
    endTimestamp: mapProviderTimestamp(
      row.endTimestamp,
      row.endTimestampPresent,
    ),
    future: row.future,
    abnormalTrafficType: row.abnormalTrafficType,
    delayMinutes: row.delayMinutes,
    averageSpeedKmh: row.averageSpeedKmh,
    coordinate: row.coordinate,
    geometry: row.geometry,
    rawData: row.rawData,
    contentHash: row.contentHash,
    lifecycleStatus: row.lifecycleStatus,
    resolvedAt: row.resolvedAt,
    ingestionMode: row.ingestionMode,
    capturedAt: row.capturedAt,
    lastSeenAt: row.lastSeenAt,
    lastLiveSeenAt: row.lastLiveSeenAt,
    contentChangedAt: row.contentChangedAt,
  };
}

function timestampValue(timestamp: ProviderTimestamp): Date | null {
  return timestamp.kind === 'value' ? timestamp.value : null;
}

function timestampPresent(timestamp: ProviderTimestamp): boolean {
  return timestamp.kind !== 'omitted';
}

function mergeProviderTimestamp(
  existing: ProviderTimestamp,
  incoming: ProviderTimestamp,
): ProviderTimestamp {
  return incoming.kind === 'omitted' ? existing : incoming;
}

function acceptsObservation(
  existing: Disruption,
  incoming: Disruption,
): boolean {
  return (
    incoming.lastSeenAt > existing.lastSeenAt &&
    !(incoming.ingestionMode === 'REPLAY' && existing.ingestionMode === 'LIVE')
  );
}

function mergeObservation(
  existing: Disruption,
  incoming: Disruption,
): Disruption {
  const merged: Disruption = {
    ...incoming,
    id: existing.id,
    source: existing.source,
    providerId: existing.providerId,
    startTimestamp: mergeProviderTimestamp(
      existing.startTimestamp,
      incoming.startTimestamp,
    ),
    endTimestamp: mergeProviderTimestamp(
      existing.endTimestamp,
      incoming.endTimestamp,
    ),
    contentHash: existing.contentHash,
    lifecycleStatus: existing.lifecycleStatus,
    resolvedAt: existing.resolvedAt,
    ingestionMode:
      incoming.ingestionMode === 'LIVE' ? 'LIVE' : existing.ingestionMode,
    capturedAt: existing.capturedAt,
    lastSeenAt: incoming.lastSeenAt,
    lastLiveSeenAt:
      incoming.ingestionMode === 'LIVE'
        ? incoming.lastSeenAt
        : existing.lastLiveSeenAt,
    contentChangedAt: existing.contentChangedAt,
  };
  const contentHash = calculateDisruptionContentHash(merged);

  return {
    ...merged,
    contentHash,
    contentChangedAt:
      contentHash === existing.contentHash
        ? existing.contentChangedAt
        : incoming.lastSeenAt,
  };
}

function queryValues(disruption: Disruption): unknown[] {
  return [
    disruption.id,
    disruption.source,
    disruption.providerId,
    disruption.category,
    disruption.disruptionType,
    disruption.queriedRoad,
    disruption.title,
    disruption.subtitle,
    JSON.stringify(disruption.description),
    timestampValue(disruption.startTimestamp),
    timestampPresent(disruption.startTimestamp),
    timestampValue(disruption.endTimestamp),
    timestampPresent(disruption.endTimestamp),
    disruption.future,
    disruption.abnormalTrafficType,
    disruption.delayMinutes,
    disruption.averageSpeedKmh,
    disruption.coordinate === null
      ? null
      : JSON.stringify(disruption.coordinate),
    disruption.geometry === null ? null : JSON.stringify(disruption.geometry),
    JSON.stringify(disruption.rawData),
    disruption.contentHash,
    disruption.lifecycleStatus,
    disruption.resolvedAt,
    disruption.ingestionMode,
    disruption.capturedAt,
    disruption.lastSeenAt,
    disruption.lastLiveSeenAt,
    disruption.contentChangedAt,
  ];
}

function createActiveDisruptionQuery(query: ActiveDisruptionQuery): {
  conditions: string[];
  values: unknown[];
} {
  const conditions = ["lifecycle_status = 'ACTIVE'"];
  const values: unknown[] = [];
  const parameter = (value: unknown): string => {
    values.push(value);
    return `$${values.length}`;
  };

  if (query.queriedRoad) {
    conditions.push(`queried_road = ${parameter(query.queriedRoad)}`);
  }

  if (query.category) {
    conditions.push(`category = ${parameter(query.category)}`);
  }

  const dateColumn = DATE_FIELD_COLUMNS[query.dateField];
  if (query.date) {
    const date = parameter(query.date);
    conditions.push(
      `${dateColumn} >= (${date}::date::timestamp AT TIME ZONE 'Europe/Berlin')`,
    );
    conditions.push(
      `${dateColumn} < ((${date}::date + 1)::timestamp AT TIME ZONE 'Europe/Berlin')`,
    );
  }

  if (query.from) {
    const from = parameter(query.from);
    conditions.push(
      `${dateColumn} >= (${from}::date::timestamp AT TIME ZONE 'Europe/Berlin')`,
    );
  }

  if (query.to) {
    const to = parameter(query.to);
    conditions.push(
      `${dateColumn} < ((${to}::date + 1)::timestamp AT TIME ZONE 'Europe/Berlin')`,
    );
  }

  return { conditions, values };
}

@Injectable()
export class PostgresDisruptionRepository {
  constructor(private readonly database: DatabaseService) {}

  async upsertObservation(
    observation: Disruption,
  ): Promise<DisruptionObservationResult> {
    return this.database.transaction(async (client) => {
      for (;;) {
        const existingResult = await client.query<DisruptionRow>(
          `SELECT ${SELECT_DISRUPTION_COLUMNS}
          FROM disruptions
          WHERE source = $1 AND provider_id = $2
          FOR UPDATE`,
          [observation.source, observation.providerId],
        );
        const existingRow = existingResult.rows[0];

        if (existingRow) {
          const existing = mapDisruption(existingRow);
          if (!acceptsObservation(existing, observation)) {
            return { outcome: 'UNCHANGED', disruption: existing };
          }

          const merged = mergeObservation(existing, observation);
          const updated = await this.update(client, merged);

          return {
            outcome:
              merged.contentHash === existing.contentHash
                ? 'UNCHANGED'
                : 'CHANGED',
            disruption: updated,
          };
        }

        const inserted = await this.insert(client, {
          ...observation,
          contentHash: calculateDisruptionContentHash(observation),
          lastLiveSeenAt:
            observation.ingestionMode === 'LIVE'
              ? observation.lastSeenAt
              : null,
          contentChangedAt: observation.lastSeenAt,
        });
        if (inserted) {
          return { outcome: 'NEW', disruption: inserted };
        }
      }
    });
  }

  async findByProviderIdentity(
    source: string,
    providerId: string,
  ): Promise<Disruption | undefined> {
    const result = await this.database.query<DisruptionRow>(
      `SELECT ${SELECT_DISRUPTION_COLUMNS}
      FROM disruptions
      WHERE source = $1 AND provider_id = $2`,
      [source, providerId],
    );

    return result.rows[0] ? mapDisruption(result.rows[0]) : undefined;
  }

  async findActiveDisruptions(
    input: Partial<ActiveDisruptionQuery> = {},
  ): Promise<DisruptionPage> {
    const query = parseActiveDisruptionQuery(input);
    const { conditions, values } = createActiveDisruptionQuery(query);
    const limit = `$${values.push(query.limit)}`;
    const offset = `$${values.push((query.page - 1) * query.limit)}`;
    const result = await this.database.query<DisruptionRow & { total: number }>(
      `WITH filtered AS (
        SELECT ${SELECT_DISRUPTION_COLUMNS}
        FROM disruptions
        WHERE ${conditions.join('\n          AND ')}
      ), total AS (
        SELECT count(*)::integer AS total
        FROM filtered
      ), paged AS (
        SELECT *
        FROM filtered
        ORDER BY "capturedAt" DESC, id ASC
        LIMIT ${limit} OFFSET ${offset}
      )
      SELECT total.total, paged.*
      FROM total
      LEFT JOIN paged ON TRUE
      ORDER BY paged."capturedAt" DESC NULLS LAST, paged.id ASC NULLS LAST`,
      values,
    );
    const first = result.rows[0];

    return {
      items: result.rows.filter((row) => row.id !== null).map(mapDisruption),
      page: query.page,
      limit: query.limit,
      total: first?.total ?? 0,
    };
  }

  private async insert(
    client: PoolClient,
    disruption: Disruption,
  ): Promise<Disruption | undefined> {
    const result = await client.query<DisruptionRow>(
      `INSERT INTO disruptions (
        id, source, provider_id, category, disruption_type, queried_road,
        title, subtitle, description, start_timestamp,
        start_timestamp_present, end_timestamp, end_timestamp_present, future,
        abnormal_traffic_type, delay_minutes, average_speed_kmh, coordinate,
        geometry, raw_data, content_hash, lifecycle_status, resolved_at,
        ingestion_mode, captured_at, last_seen_at, last_live_seen_at,
        content_changed_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14,
        $15, $16, $17, $18::jsonb, $19::jsonb, $20::jsonb, $21, $22, $23,
        $24, $25, $26, $27, $28
      ) ON CONFLICT (source, provider_id) DO NOTHING
      RETURNING ${SELECT_DISRUPTION_COLUMNS}`,
      queryValues(disruption),
    );

    return result.rows[0] ? mapDisruption(result.rows[0]) : undefined;
  }

  private async update(
    client: PoolClient,
    disruption: Disruption,
  ): Promise<Disruption> {
    const result = await client.query<DisruptionRow>(
      `UPDATE disruptions SET
        category = $4,
        disruption_type = $5,
        queried_road = $6,
        title = $7,
        subtitle = $8,
        description = $9::jsonb,
        start_timestamp = $10,
        start_timestamp_present = $11,
        end_timestamp = $12,
        end_timestamp_present = $13,
        future = $14,
        abnormal_traffic_type = $15,
        delay_minutes = $16,
        average_speed_kmh = $17,
        coordinate = $18::jsonb,
        geometry = $19::jsonb,
        raw_data = $20::jsonb,
        content_hash = $21,
        lifecycle_status = $22,
        resolved_at = $23,
        ingestion_mode = $24,
        captured_at = $25,
        last_seen_at = $26,
        last_live_seen_at = $27,
        content_changed_at = $28
      WHERE source = $2 AND provider_id = $3 AND id = $1
      RETURNING ${SELECT_DISRUPTION_COLUMNS}`,
      queryValues(disruption),
    );
    const row = result.rows[0];

    if (!row) {
      throw new Error('disruption observation update did not return a record');
    }

    return mapDisruption(row);
  }
}
