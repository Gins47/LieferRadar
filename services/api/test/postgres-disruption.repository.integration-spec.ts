import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { Client } from 'pg';
import { DatabaseModule } from '../src/database/database.module';
import { DatabaseService } from '../src/database/database.service';
import { calculateDisruptionContentHash } from '../src/disruption/model/disruption-content-hash';
import { Disruption } from '../src/disruption/model/disruption.model';
import { PostgresDisruptionRepository } from '../src/disruption/repository/postgres-disruption.repository';
import { getTestDatabaseUrl } from './database-test-context';

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

    expect(firstPage).toMatchObject({ page: 1, limit: 2, total: 3 });
    expect(firstPage.items.map((item) => item.id)).toEqual([
      observations[1].disruption.id,
      observations[2].disruption.id,
    ]);
    expect(secondPage).toMatchObject({ page: 2, limit: 2, total: 3 });
    expect(secondPage.items.map((item) => item.id)).toEqual([
      observations[0].disruption.id,
    ]);
    expect(emptyPage).toEqual({ items: [], page: 3, limit: 2, total: 3 });
  });
});
