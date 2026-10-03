import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Test, TestingModule } from '@nestjs/testing';
import { Client } from 'pg';
import { DatabaseModule } from '../src/database/database.module';
import { DatabaseService } from '../src/database/database.service';
import { calculateDisruptionContentHash } from '../src/disruption/model/disruption-content-hash';
import {
  Disruption,
  JsonObject,
  JsonValue,
} from '../src/disruption/model/disruption.model';
import { PostgresDisruptionRepository } from '../src/disruption/repository/postgres-disruption.repository';
import { getTestDatabaseUrl } from './database-test-context';

interface AutobahnWarningFixture {
  identifier: string;
  source: string;
  display_type: string;
  title: string;
  subtitle?: string;
  description: JsonValue[];
  startTimestamp?: string | null;
  endTimestamp?: string | null;
  future?: boolean;
  abnormalTrafficType?: string;
  delayTimeValue?: unknown;
  averageSpeed?: unknown;
  coordinate?: JsonValue;
  geometry?: JsonValue;
}

const authenticA1Warnings = (
  JSON.parse(
    readFileSync(
      join(process.cwd(), 'test/fixtures/autobahn/a1-warnings-2026-10.03.json'),
      'utf8',
    ),
  ) as { warning: AutobahnWarningFixture[] }
).warning;

async function createClient(): Promise<Client> {
  const client = new Client({ connectionString: getTestDatabaseUrl() });
  await client.connect();
  return client;
}

function createObservation(overrides: Partial<Disruption> = {}): Disruption {
  return {
    id: randomUUID(),
    source: 'autobahn',
    providerId: 'INRIX--vi-avl.2026-10-03_06-53-00-000_003.de0',
    category: 'WARNING',
    disruptionType: 'QUEUING_TRAFFIC',
    queriedRoad: 'A1',
    title: 'A1 | Bargteheide - Ahrensburg',
    subtitle: ' Lübeck -> Hamburg',
    description: [
      'Stau',
      'A1: Lübeck -> Hamburg, zwischen Bargteheide und Ahrensburg',
    ],
    startTimestamp: {
      kind: 'value',
      value: new Date('2026-10-03T06:53:00.000Z'),
    },
    endTimestamp: { kind: 'omitted' },
    future: false,
    abnormalTrafficType: 'QUEUING_TRAFFIC',
    delayMinutes: 18,
    averageSpeedKmh: null,
    coordinate: { lat: 53.68, long: 10.24 },
    geometry: {
      type: 'LineString',
      coordinates: [
        [10.24, 53.68],
        [10.23, 53.67],
      ],
    },
    rawData: { identifier: 'provider payload', unknownProviderField: true },
    contentHash: 'a'.repeat(64),
    lifecycleStatus: 'ACTIVE',
    resolvedAt: null,
    ingestionMode: 'REPLAY',
    capturedAt: new Date('2026-10-03T07:00:00.000Z'),
    lastSeenAt: new Date('2026-10-03T07:00:00.000Z'),
    lastLiveSeenAt: null,
    contentChangedAt: new Date('2026-10-03T07:00:00.000Z'),
    ...overrides,
  };
}

function providerTimestamp(
  value: string | null | undefined,
): Disruption['startTimestamp'] {
  if (value === undefined) {
    return { kind: 'omitted' };
  }

  if (value === null) {
    return { kind: 'explicit-null' };
  }

  return { kind: 'value', value: new Date(value) };
}

function fixtureNumber(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function createAuthenticWarningObservation(
  warning: AutobahnWarningFixture,
  overrides: Partial<Disruption> = {},
): Disruption {
  const capturedAt = new Date('2026-10-03T07:00:00.000Z');

  return createObservation({
    id: randomUUID(),
    source: warning.source,
    providerId: warning.identifier,
    category: warning.display_type,
    disruptionType: warning.abnormalTrafficType ?? 'WARNING',
    queriedRoad: 'A1',
    title: warning.title,
    subtitle: warning.subtitle ?? null,
    description: warning.description,
    startTimestamp: providerTimestamp(warning.startTimestamp),
    endTimestamp: providerTimestamp(warning.endTimestamp),
    future: warning.future ?? null,
    abnormalTrafficType: warning.abnormalTrafficType ?? null,
    delayMinutes: fixtureNumber(warning.delayTimeValue),
    averageSpeedKmh: fixtureNumber(warning.averageSpeed),
    coordinate: warning.coordinate ?? null,
    geometry: warning.geometry ?? null,
    rawData: warning as unknown as JsonObject,
    capturedAt,
    lastSeenAt: capturedAt,
    contentChangedAt: capturedAt,
    ...overrides,
  });
}

describe('PostgresDisruptionRepository', () => {
  let client: Client;
  let module: TestingModule;
  let repository: PostgresDisruptionRepository;

  beforeEach(async () => {
    client = await createClient();
    await client.query('DELETE FROM disruptions');

    module = await Test.createTestingModule({
      imports: [DatabaseModule],
      providers: [PostgresDisruptionRepository],
    }).compile();
    repository = module.get(PostgresDisruptionRepository);
  });

  afterEach(async () => {
    await module.close();
    await client.end();
  });

  it('inserts and retrieves an active disruption by provider identity', async () => {
    const observation = createObservation();

    const result = await repository.upsertObservation(observation);

    expect(result.outcome).toBe('NEW');
    expect(result.disruption.contentHash).toBe(
      calculateDisruptionContentHash(observation),
    );
    expect(result.disruption.description).toEqual(observation.description);
    expect(result.disruption.geometry).toEqual(observation.geometry);
    expect(result.disruption.rawData).toEqual(observation.rawData);

    await expect(
      repository.findByProviderIdentity(
        observation.source,
        observation.providerId,
      ),
    ).resolves.toEqual(result.disruption);
    await expect(repository.findActiveDisruptions()).resolves.toEqual({
      items: [result.disruption],
      page: 1,
      limit: 20,
      total: 1,
    });
  });

  it('advances an unchanged observation without changing its content version', async () => {
    const original = createObservation();
    const inserted = await repository.upsertObservation(original);
    const repeated = createObservation({
      id: randomUUID(),
      rawData: { identifier: 'provider payload', unknownProviderField: 'new' },
      capturedAt: new Date('2026-10-03T07:05:00.000Z'),
      lastSeenAt: new Date('2026-10-03T07:05:00.000Z'),
      contentChangedAt: new Date('2026-10-03T07:05:00.000Z'),
    });

    const result = await repository.upsertObservation(repeated);

    expect(result.outcome).toBe('UNCHANGED');
    expect(result.disruption.id).toBe(inserted.disruption.id);
    expect(result.disruption.capturedAt).toEqual(original.capturedAt);
    expect(result.disruption.lastSeenAt).toEqual(repeated.lastSeenAt);
    expect(result.disruption.contentChangedAt).toEqual(
      original.contentChangedAt,
    );
    expect(result.disruption.rawData).toEqual(repeated.rawData);
  });

  it('updates changed content and queried-road context while preserving identity', async () => {
    const original = createObservation();
    const inserted = await repository.upsertObservation(original);
    const changed = createObservation({
      id: randomUUID(),
      queriedRoad: 'A2',
      title: 'A2 | Changed retrieval context',
      lastSeenAt: new Date('2026-10-03T07:10:00.000Z'),
      contentChangedAt: new Date('2026-10-03T07:10:00.000Z'),
    });

    const result = await repository.upsertObservation(changed);

    expect(result.outcome).toBe('CHANGED');
    expect(result.disruption.id).toBe(inserted.disruption.id);
    expect(result.disruption.capturedAt).toEqual(original.capturedAt);
    expect(result.disruption.queriedRoad).toBe('A2');
    expect(result.disruption.title).toBe(changed.title);
    expect(result.disruption.contentHash).toBe(
      calculateDisruptionContentHash(changed),
    );
    expect(result.disruption.contentChangedAt).toEqual(changed.lastSeenAt);

    const equalTimeDifferentRoad = await repository.upsertObservation(
      createObservation({
        id: randomUUID(),
        queriedRoad: 'A3',
        lastSeenAt: changed.lastSeenAt,
        contentChangedAt: changed.lastSeenAt,
      }),
    );

    expect(equalTimeDifferentRoad.outcome).toBe('UNCHANGED');
    expect(equalTimeDifferentRoad.disruption.queriedRoad).toBe('A2');
  });

  it('preserves omitted timestamps and applies explicit-null and value corrections', async () => {
    const original = createObservation({
      endTimestamp: { kind: 'omitted' },
    });
    await repository.upsertObservation(original);

    const explicitNull = await repository.upsertObservation(
      createObservation({
        id: randomUUID(),
        startTimestamp: { kind: 'omitted' },
        endTimestamp: { kind: 'explicit-null' },
        lastSeenAt: new Date('2026-10-03T07:05:00.000Z'),
        contentChangedAt: new Date('2026-10-03T07:05:00.000Z'),
      }),
    );

    expect(explicitNull.disruption.startTimestamp).toEqual(
      original.startTimestamp,
    );
    expect(explicitNull.disruption.endTimestamp).toEqual({
      kind: 'explicit-null',
    });

    const corrected = await repository.upsertObservation(
      createObservation({
        id: randomUUID(),
        startTimestamp: { kind: 'explicit-null' },
        endTimestamp: {
          kind: 'value',
          value: new Date('2026-10-03T09:00:00.000Z'),
        },
        lastSeenAt: new Date('2026-10-03T07:10:00.000Z'),
        contentChangedAt: new Date('2026-10-03T07:10:00.000Z'),
      }),
    );

    expect(corrected.disruption.startTimestamp).toEqual({
      kind: 'explicit-null',
    });
    expect(corrected.disruption.endTimestamp).toEqual({
      kind: 'value',
      value: new Date('2026-10-03T09:00:00.000Z'),
    });
  });

  it('persists missing optional fields as null', async () => {
    const observation = createObservation({
      subtitle: null,
      future: null,
      abnormalTrafficType: null,
      delayMinutes: null,
      averageSpeedKmh: null,
      coordinate: null,
      geometry: null,
    });

    const result = await repository.upsertObservation(observation);

    expect(result.disruption).toMatchObject({
      subtitle: null,
      future: null,
      abnormalTrafficType: null,
      delayMinutes: null,
      averageSpeedKmh: null,
      coordinate: null,
      geometry: null,
    });
  });

  it('does not let replay overwrite a newer live observation', async () => {
    const liveObservation = createObservation({
      ingestionMode: 'LIVE',
      lastLiveSeenAt: null,
    });
    const inserted = await repository.upsertObservation(liveObservation);
    expect(inserted.disruption.lastLiveSeenAt).toEqual(
      liveObservation.lastSeenAt,
    );
    const staleLive = await repository.upsertObservation(
      createObservation({
        id: randomUUID(),
        ingestionMode: 'LIVE',
        title: 'Stale live warning',
        lastSeenAt: new Date('2026-10-03T06:59:00.000Z'),
        contentChangedAt: new Date('2026-10-03T06:59:00.000Z'),
      }),
    );
    const replay = createObservation({
      id: randomUUID(),
      title: 'Historical replay must not replace the live warning',
      lastSeenAt: new Date('2026-10-03T08:00:00.000Z'),
      contentChangedAt: new Date('2026-10-03T08:00:00.000Z'),
    });

    const result = await repository.upsertObservation(replay);

    expect(staleLive.outcome).toBe('UNCHANGED');
    expect(staleLive.disruption).toEqual(inserted.disruption);
    expect(result.outcome).toBe('UNCHANGED');
    expect(result.disruption).toEqual(inserted.disruption);
  });

  it('handles concurrent duplicate observations through one stable identity', async () => {
    const observations = Array.from({ length: 8 }, () =>
      createObservation({ id: randomUUID() }),
    );

    const results = await Promise.all(
      observations.map((observation) =>
        repository.upsertObservation(observation),
      ),
    );
    const count = await client.query<{ count: string }>(
      'SELECT count(*) FROM disruptions',
    );

    expect(results.filter((result) => result.outcome === 'NEW')).toHaveLength(
      1,
    );
    expect(new Set(results.map((result) => result.disruption.id)).size).toBe(1);
    expect(count.rows[0]?.count).toBe('1');
  });

  it('returns only active disruptions', async () => {
    const active = await repository.upsertObservation(createObservation());
    await repository.upsertObservation(
      createObservation({
        id: randomUUID(),
        providerId: 'INRIX--resolved',
        lifecycleStatus: 'RESOLVED',
        resolvedAt: new Date('2026-10-03T07:00:00.000Z'),
      }),
    );

    await expect(repository.findActiveDisruptions()).resolves.toEqual({
      items: [active.disruption],
      page: 1,
      limit: 20,
      total: 1,
    });
  });

  it('preserves the newest observation during concurrent updates', async () => {
    const first = await repository.upsertObservation(createObservation());
    const observations = [10, 5, 20, 15].map((minute) =>
      createObservation({
        title: `Changed warning ${minute}`,
        lastSeenAt: new Date(
          `2026-10-03T07:${minute.toString().padStart(2, '0')}:00.000Z`,
        ),
      }),
    );
    await Promise.all(
      observations.map((observation) =>
        repository.upsertObservation(observation),
      ),
    );
    const count = await client.query<{ count: string }>(
      'SELECT count(*) FROM disruptions',
    );
    const stored = await repository.findByProviderIdentity(
      first.disruption.source,
      first.disruption.providerId,
    );

    expect(stored?.id).toBe(first.disruption.id);
    expect(stored?.title).toBe('Changed warning 20');
    expect(stored?.lastSeenAt).toEqual(new Date('2026-10-03T07:20:00.000Z'));
    expect(stored?.contentChangedAt).toEqual(stored?.lastSeenAt);
    expect(stored?.capturedAt).toEqual(first.disruption.capturedAt);
    expect(count.rows[0]?.count).toBe('1');
  });

  it('hashes preserved timestamps and promotes replay to live without changing content', async () => {
    const first = await repository.upsertObservation(createObservation());
    const promoted = await repository.upsertObservation(
      createObservation({
        ingestionMode: 'LIVE',
        startTimestamp: { kind: 'omitted' },
        lastSeenAt: new Date('2026-10-03T07:05:00.000Z'),
      }),
    );
    expect(promoted.outcome).toBe('UNCHANGED');
    expect(promoted.disruption.startTimestamp).toEqual(
      first.disruption.startTimestamp,
    );
    expect(promoted.disruption.contentHash).toBe(first.disruption.contentHash);
    expect(promoted.disruption.contentHash).toBe(
      calculateDisruptionContentHash(promoted.disruption),
    );
    expect(promoted.disruption.contentChangedAt).toEqual(
      first.disruption.contentChangedAt,
    );
    expect(promoted.disruption.ingestionMode).toBe('LIVE');
    expect(promoted.disruption.lastLiveSeenAt).toEqual(
      promoted.disruption.lastSeenAt,
    );
    expect(promoted.disruption.lifecycleStatus).toBe('ACTIVE');
  });

  it('rolls back failed transactions and releases the connection for later work', async () => {
    const database = module.get(DatabaseService);
    const failure = new Error('controlled transaction failure');
    await expect(
      database.transaction(async (connection) => {
        await connection.query(
          'INSERT INTO products (id, sku, name) VALUES ($1, $2, $3)',
          ['CP4-ROLLBACK', 'TEST', 'Rollback probe'],
        );
        throw failure;
      }),
    ).rejects.toBe(failure);
    const rows = await client.query('SELECT id FROM products WHERE id = $1', [
      'CP4-ROLLBACK',
    ]);
    expect(rows.rows).toEqual([]);
    await expect(
      repository.upsertObservation(createObservation()),
    ).resolves.toMatchObject({ outcome: 'NEW' });
  });

  it('keeps sources distinct and treats identity lookup inputs as parameters', async () => {
    const original = createObservation();
    await repository.upsertObservation(original);
    await repository.upsertObservation(
      createObservation({ source: 'another-provider' }),
    );
    expect((await repository.findActiveDisruptions()).items).toHaveLength(2);
    await expect(
      repository.findByProviderIdentity(
        "autobahn' OR '1' = '1",
        original.providerId,
      ),
    ).resolves.toBeUndefined();
    await expect(
      repository.findByProviderIdentity(
        original.source,
        "missing' OR '1' = '1",
      ),
    ).resolves.toBeUndefined();
  });

  it('filters active disruptions by queried road and category', async () => {
    const matching = await repository.upsertObservation(
      createObservation({ providerId: 'A1-WARNING' }),
    );
    await repository.upsertObservation(
      createObservation({
        providerId: 'A1-CLOSURE',
        category: 'CLOSURE',
        disruptionType: 'CLOSURE',
      }),
    );
    await repository.upsertObservation(
      createObservation({ providerId: 'A8-WARNING', queriedRoad: 'A8' }),
    );
    await repository.upsertObservation(
      createObservation({
        providerId: 'A1-RESOLVED',
        lifecycleStatus: 'RESOLVED',
        resolvedAt: new Date('2026-10-03T07:00:00.000Z'),
      }),
    );

    await expect(
      repository.findActiveDisruptions({
        queriedRoad: 'A1',
        category: 'WARNING',
        from: '2026-10-03',
        to: '2026-10-03',
      }),
    ).resolves.toMatchObject({
      items: [matching.disruption],
      total: 1,
    });
  });

  it('uses inclusive Berlin lower bounds and exclusive upper bounds', async () => {
    const lowerBound = await repository.upsertObservation(
      createObservation({
        providerId: 'BERLIN-LOWER-BOUND',
        startTimestamp: {
          kind: 'value',
          value: new Date('2026-10-02T22:00:00.000Z'),
        },
      }),
    );
    await repository.upsertObservation(
      createObservation({
        providerId: 'BERLIN-BEFORE-BOUND',
        startTimestamp: {
          kind: 'value',
          value: new Date('2026-10-02T21:59:59.999Z'),
        },
      }),
    );
    await repository.upsertObservation(
      createObservation({
        providerId: 'BERLIN-UPPER-BOUND',
        startTimestamp: {
          kind: 'value',
          value: new Date('2026-10-03T22:00:00.000Z'),
        },
      }),
    );

    await expect(
      repository.findActiveDisruptions({ date: '2026-10-03' }),
    ).resolves.toMatchObject({
      items: [lowerBound.disruption],
      total: 1,
    });
  });

  it('filters by the selected capture timestamp field', async () => {
    const matching = await repository.upsertObservation(
      createObservation({
        providerId: 'CAPTURED-ON-OCTOBER-THIRD',
        startTimestamp: {
          kind: 'value',
          value: new Date('2026-10-01T12:00:00.000Z'),
        },
        capturedAt: new Date('2026-10-02T22:00:00.000Z'),
        lastSeenAt: new Date('2026-10-02T22:00:00.000Z'),
        contentChangedAt: new Date('2026-10-02T22:00:00.000Z'),
      }),
    );

    await expect(
      repository.findActiveDisruptions({
        date: '2026-10-03',
        dateField: 'capturedAt',
      }),
    ).resolves.toMatchObject({
      items: [matching.disruption],
      total: 1,
    });
  });

  it('paginates with accurate totals and deterministic capture-time ordering', async () => {
    const captureTime = new Date('2026-10-03T07:00:00.000Z');
    const observations = await Promise.all(
      [
        ['00000000-0000-0000-0000-000000000003', 'PAGED-THREE'],
        ['00000000-0000-0000-0000-000000000001', 'PAGED-ONE'],
        ['00000000-0000-0000-0000-000000000002', 'PAGED-TWO'],
      ].map(([id, providerId]) =>
        repository.upsertObservation(
          createObservation({
            id,
            providerId,
            capturedAt: captureTime,
            lastSeenAt: captureTime,
            contentChangedAt: captureTime,
          }),
        ),
      ),
    );
    const newer = await repository.upsertObservation(
      createObservation({
        id: '00000000-0000-0000-0000-000000000004',
        providerId: 'PAGED-NEWER',
        capturedAt: new Date('2026-10-03T07:01:00.000Z'),
        lastSeenAt: new Date('2026-10-03T07:01:00.000Z'),
      }),
    );

    const firstPage = await repository.findActiveDisruptions({
      page: 1,
      limit: 2,
    });
    const secondPage = await repository.findActiveDisruptions({
      page: 2,
      limit: 2,
    });
    const emptyPage = await repository.findActiveDisruptions({
      page: 3,
      limit: 2,
    });

    expect(firstPage).toMatchObject({ page: 1, limit: 2, total: 4 });
    expect(firstPage.items.map((item) => item.id)).toEqual([
      newer.disruption.id,
      observations[1].disruption.id,
    ]);
    expect(secondPage).toMatchObject({ page: 2, limit: 2, total: 4 });
    expect(secondPage.items.map((item) => item.id)).toEqual([
      observations[2].disruption.id,
      observations[0].disruption.id,
    ]);
    expect(emptyPage).toEqual({ items: [], page: 3, limit: 2, total: 4 });
  });

  it('preserves authentic A1 warning text, raw payloads and complete geometry', async () => {
    const stored = await Promise.all(
      authenticA1Warnings.map((warning) =>
        repository.upsertObservation(
          createAuthenticWarningObservation(warning),
        ),
      ),
    );

    const page = await repository.findActiveDisruptions({
      queriedRoad: 'A1',
      category: 'WARNING',
    });

    expect(page.total).toBe(authenticA1Warnings.length);
    for (const [index, warning] of authenticA1Warnings.entries()) {
      const disruption = page.items.find(
        (item) => item.providerId === warning.identifier,
      );

      expect(disruption).toMatchObject({
        source: warning.source,
        category: warning.display_type,
        description: warning.description,
        coordinate: warning.coordinate,
        geometry: warning.geometry,
        rawData: warning,
      });
      expect(disruption?.geometry).toEqual(warning.geometry);
      expect(disruption?.rawData).toEqual(warning);
      expect(disruption?.disruptionType).toBe(
        warning.abnormalTrafficType ?? 'WARNING',
      );
      expect(stored[index].disruption.providerId).toBe(warning.identifier);
    }
  });

  it('keeps omitted and explicit-null starts distinct and excludes both from start-date filtering', async () => {
    const omitted = await repository.upsertObservation(
      createObservation({
        providerId: 'OMITTED-START',
        startTimestamp: { kind: 'omitted' },
      }),
    );
    const explicitNull = await repository.upsertObservation(
      createObservation({
        providerId: 'EXPLICIT-NULL-START',
        startTimestamp: { kind: 'explicit-null' },
      }),
    );

    const allActive = await repository.findActiveDisruptions();
    const dateFiltered = await repository.findActiveDisruptions({
      date: '2026-10-03',
    });

    expect(allActive.items).toEqual(
      expect.arrayContaining([omitted.disruption, explicitNull.disruption]),
    );
    expect(dateFiltered).toEqual({ items: [], page: 1, limit: 20, total: 0 });
    expect(omitted.disruption.startTimestamp).toEqual({ kind: 'omitted' });
    expect(explicitNull.disruption.startTimestamp).toEqual({
      kind: 'explicit-null',
    });
  });

  it('applies one-sided calendar-date ranges', async () => {
    const before = await repository.upsertObservation(
      createObservation({
        providerId: 'RANGE-BEFORE',
        startTimestamp: {
          kind: 'value',
          value: new Date('2026-10-02T12:00:00.000Z'),
        },
      }),
    );
    const during = await repository.upsertObservation(
      createObservation({
        providerId: 'RANGE-DURING',
        startTimestamp: {
          kind: 'value',
          value: new Date('2026-10-03T12:00:00.000Z'),
        },
      }),
    );
    const after = await repository.upsertObservation(
      createObservation({
        providerId: 'RANGE-AFTER',
        startTimestamp: {
          kind: 'value',
          value: new Date('2026-10-04T12:00:00.000Z'),
        },
      }),
    );

    const from = await repository.findActiveDisruptions({
      from: '2026-10-03',
    });
    const to = await repository.findActiveDisruptions({ to: '2026-10-03' });

    expect(from.items.map((item) => item.id)).toEqual(
      expect.arrayContaining([during.disruption.id, after.disruption.id]),
    );
    expect(from.items.map((item) => item.id)).not.toContain(
      before.disruption.id,
    );
    expect(to.items.map((item) => item.id)).toEqual(
      expect.arrayContaining([before.disruption.id, during.disruption.id]),
    );
    expect(to.items.map((item) => item.id)).not.toContain(after.disruption.id);
  });

  it('uses Berlin DST boundaries independently of PostgreSQL session timezone', async () => {
    const days = [
      {
        date: '2026-03-29',
        lower: '2026-03-28T23:00:00.000Z',
        lastInside: '2026-03-29T21:59:59.999Z',
        upper: '2026-03-29T22:00:00.000Z',
      },
      {
        date: '2026-10-25',
        lower: '2026-10-24T22:00:00.000Z',
        lastInside: '2026-10-25T22:59:59.999Z',
        upper: '2026-10-25T23:00:00.000Z',
      },
    ];
    // Synthetic boundary records cover both the 23-hour and 25-hour days.
    for (const day of days) {
      for (const [position, timestamp] of [
        ['lower', day.lower],
        ['lastInside', day.lastInside],
        ['upper', day.upper],
      ]) {
        await repository.upsertObservation(
          createObservation({
            providerId: `${day.date}-${position}`,
            startTimestamp: { kind: 'value', value: new Date(timestamp) },
          }),
        );
      }
    }
    const database = module.get(DatabaseService);
    // Execute the real repository SQL on the client whose timezone is set.
    const query = jest
      .spyOn(database, 'query')
      .mockImplementation((sql, values) => client.query(sql, values));

    try {
      for (const timezone of ['UTC', 'America/New_York']) {
        const setting = await client.query<{ timezone: string }>(
          "SELECT set_config('TimeZone', $1, false) AS timezone",
          [timezone],
        );
        expect(setting.rows[0]?.timezone).toBe(timezone);

        for (const day of days) {
          const page = await repository.findActiveDisruptions({
            date: day.date,
          });
          expect(page.total).toBe(2);
          expect(page.items.map((item) => item.providerId).sort()).toEqual(
            [`${day.date}-lower`, `${day.date}-lastInside`].sort(),
          );
        }
      }
    } finally {
      query.mockRestore();
    }
  });

  it('does not infer interval overlap or resolution from a missing end timestamp', async () => {
    const disruption = await repository.upsertObservation(
      createObservation({
        providerId: 'MISSING-END',
        startTimestamp: {
          kind: 'value',
          value: new Date('2026-10-02T12:00:00.000Z'),
        },
        endTimestamp: { kind: 'omitted' },
      }),
    );

    await expect(
      repository.findActiveDisruptions({ date: '2026-10-03' }),
    ).resolves.toEqual({ items: [], page: 1, limit: 20, total: 0 });
    await expect(repository.findActiveDisruptions()).resolves.toMatchObject({
      items: [
        expect.objectContaining({
          id: disruption.disruption.id,
          lifecycleStatus: 'ACTIVE',
          endTimestamp: { kind: 'omitted' },
        }),
      ],
      total: 1,
    });
  });

  it('treats SQL-like filter values as literal parameters', async () => {
    const literal = await repository.upsertObservation(
      createObservation({
        providerId: 'SQL-LITERAL',
        queriedRoad: "A1' OR '1' = '1",
        category: "WARNING' OR '1' = '1",
      }),
    );
    await repository.upsertObservation(
      createObservation({ providerId: 'ORDINARY-A1' }),
    );

    await expect(
      repository.findActiveDisruptions({
        queriedRoad: "A1' OR '1' = '1",
        category: "WARNING' OR '1' = '1",
      }),
    ).resolves.toMatchObject({
      items: [literal.disruption],
      total: 1,
    });
  });

  it('returns an empty page with a zero total when no disruptions match', async () => {
    await repository.upsertObservation(createObservation());

    await expect(
      repository.findActiveDisruptions({ queriedRoad: 'A99' }),
    ).resolves.toEqual({ items: [], page: 1, limit: 20, total: 0 });
  });

  it('propagates database query failures', async () => {
    const database = module.get(DatabaseService);
    const failure = new Error('controlled query failure');
    jest.spyOn(database, 'query').mockRejectedValueOnce(failure);

    await expect(repository.findActiveDisruptions()).rejects.toBe(failure);
  });
});
