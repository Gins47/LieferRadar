import { AutobahnClient } from './autobahn.client';
import { AutobahnCollectionService } from './autobahn-collection.service';
import { PostgresDisruptionRepository } from '../../disruption/repository/postgres-disruption.repository';

const warning = {
  identifier: 'INRIX--vi-avl.2026-10-03_06-53-00-000_003.de0',
  display_type: 'WARNING',
  title: 'A1 | Bargteheide - Ahrensburg',
  subtitle: ' Lübeck -> Hamburg',
  description: ['Stau'],
  startTimestamp: '2026-10-03T06:53:00Z',
  abnormalTrafficType: 'QUEUING_TRAFFIC',
  delayTimeValue: '18',
  geometry: {
    type: 'LineString',
    coordinates: [
      [10.2, 53.6],
      [10.1, 53.5],
    ],
  },
};

describe('AutobahnCollectionService', () => {
  function createService(
    warnings: unknown[],
    outcomes: Array<'NEW' | 'CHANGED' | 'UNCHANGED'> = ['NEW'],
  ) {
    const fetchWarnings = jest.fn().mockResolvedValue(warnings);
    const client = {
      fetchWarnings,
    } as unknown as AutobahnClient;
    const upsertObservation = jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve({ outcome: outcomes.shift() ?? 'UNCHANGED' }),
      );
    const repository = {
      upsertObservation,
    } as unknown as PostgresDisruptionRepository;

    return {
      service: new AutobahnCollectionService(client, repository),
      fetchWarnings,
      upsertObservation,
    };
  }

  it('persists all normalized provider warnings and counts their outcomes', async () => {
    const { service, fetchWarnings, upsertObservation } = createService(
      [
        warning,
        { ...warning, identifier: 'warning-2' },
        { ...warning, identifier: 'warning-3' },
      ],
      ['NEW', 'CHANGED', 'UNCHANGED'],
    );

    await expect(service.collectWarnings('A1')).resolves.toMatchObject({
      road: 'A1',
      category: 'WARNING',
      mode: 'LIVE',
      status: 'complete',
      collected: 3,
      inserted: 1,
      updated: 1,
      unchanged: 1,
      failures: [],
    });
    expect(fetchWarnings).toHaveBeenCalledWith('A1');
    expect(upsertObservation).toHaveBeenCalledTimes(3);
  });

  it('preserves successful observations when one record is invalid', async () => {
    const { service, upsertObservation } = createService([
      warning,
      { identifier: 'invalid', description: [] },
    ]);

    await expect(service.collectWarnings('A1')).resolves.toMatchObject({
      status: 'partial',
      collected: 2,
      inserted: 1,
      failures: [expect.objectContaining({ providerId: 'invalid' })],
    });
    expect(upsertObservation).toHaveBeenCalledTimes(1);
  });

  it('labels fixture imports as replay observations', async () => {
    const { service, upsertObservation } = createService([warning]);

    await expect(
      service.replayWarnings(
        'A1',
        [warning],
        new Date('2026-10-03T07:00:00.000Z'),
      ),
    ).resolves.toMatchObject({ mode: 'REPLAY', inserted: 1 });
    expect(upsertObservation).toHaveBeenCalledWith(
      expect.objectContaining({
        ingestionMode: 'REPLAY',
        lastLiveSeenAt: null,
      }),
    );
  });
});
