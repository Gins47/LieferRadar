import { PostgresDisruptionRepository } from './postgres-disruption.repository';

describe('PostgresDisruptionRepository live warning reads', () => {
  it('includes a resolved LIVE warning observed today on a saved road', async () => {
    const observedAt = new Date('2026-10-05T09:00:00.000Z');
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          total: 1,
          id: 'live-warning',
          source: 'autobahn',
          providerId: 'provider-warning',
          category: 'WARNING',
          disruptionType: 'TRAFFIC',
          queriedRoad: 'A1',
          title: 'A1 warning',
          subtitle: null,
          description: [],
          startTimestamp: null,
          startTimestampPresent: false,
          endTimestamp: null,
          endTimestampPresent: false,
          future: null,
          abnormalTrafficType: null,
          delayMinutes: null,
          averageSpeedKmh: null,
          coordinate: null,
          geometry: null,
          rawData: {},
          contentHash: 'hash',
          lifecycleStatus: 'RESOLVED',
          resolvedAt: observedAt,
          ingestionMode: 'LIVE',
          capturedAt: observedAt,
          lastSeenAt: observedAt,
          contentChangedAt: observedAt,
        },
      ],
    });
    const repository = new PostgresDisruptionRepository({ query } as never);

    await expect(
      repository.findLiveWarnings({
        roads: ['A1'],
        observedOn: '2026-10-05',
        page: 2,
        limit: 20,
      }),
    ).resolves.toMatchObject({
      page: 2,
      limit: 20,
      total: 1,
      items: [
        {
          id: 'live-warning',
          ingestionMode: 'LIVE',
          lifecycleStatus: 'RESOLVED',
          lastLiveSeenAt: observedAt,
        },
      ],
    });

    const [sql, values] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("ingestion_mode = 'LIVE'");
    expect(sql).not.toContain("lifecycle_status = 'ACTIVE'");
    expect(sql).toContain("source = 'autobahn'");
    expect(sql).toContain("category = 'WARNING'");
    expect(sql).toContain("TIME ZONE 'Europe/Berlin'");
    expect(sql).toContain('last_seen_at');
    expect(sql).toContain('ORDER BY "lastSeenAt" DESC, id ASC');
    expect(sql).not.toContain('last_live_seen_at');
    expect(sql).toContain('count(*)::integer AS total');
    expect(values).toEqual([['A1'], '2026-10-05', 20, 20]);
  });

  it('does not query when no saved shipment roads exist', async () => {
    const query = jest.fn();
    const repository = new PostgresDisruptionRepository({ query } as never);

    await expect(
      repository.findLiveWarnings({
        roads: [],
        observedOn: '2026-10-05',
        page: 1,
        limit: 20,
      }),
    ).resolves.toEqual({ items: [], page: 1, limit: 20, total: 0 });
    expect(query).not.toHaveBeenCalled();
  });
});
