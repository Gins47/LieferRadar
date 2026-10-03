import { Disruption, JsonObject } from './disruption.model';
import { calculateDisruptionContentHash } from './disruption-content-hash';

function createDisruption(overrides: Partial<Disruption> = {}): Disruption {
  return {
    id: 'a5b91d72-8a6e-47c2-a6b5-6fd59e9c1218',
    source: 'autobahn',
    providerId: 'INRIX--vi-avl.2026-10-03_06-53-00-000_003.de0',
    category: 'WARNING',
    disruptionType: 'QUEUING_TRAFFIC',
    queriedRoad: 'A1',
    title: 'A1 | Bargteheide - Ahrensburg',
    subtitle: ' Lübeck -> Hamburg',
    description: [
      'Stau',
      { direction: 'Lübeck -> Hamburg', location: 'Ahrensburg' },
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
      coordinates: [
        [10.24, 53.68],
        [10.23, 53.67],
      ],
      type: 'LineString',
    },
    rawData: { identifier: 'provider payload' },
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

describe('calculateDisruptionContentHash', () => {
  it('retains JSON object keys such as __proto__ in canonical content', () => {
    const geometry = JSON.parse(
      '{"type":"LineString","__proto__":{"evidence":"first"}}',
    ) as JsonObject;
    const changedGeometry = JSON.parse(
      '{"__proto__":{"evidence":"second"},"type":"LineString"}',
    ) as JsonObject;
    expect(
      calculateDisruptionContentHash(createDisruption({ geometry })),
    ).not.toBe(
      calculateDisruptionContentHash(
        createDisruption({ geometry: changedGeometry }),
      ),
    );
  });
  it('returns the same hash for equivalent recursively reordered objects', () => {
    const original = createDisruption();
    const reordered = createDisruption({
      coordinate: { long: 10.24, lat: 53.68 },
      description: [
        'Stau',
        { location: 'Ahrensburg', direction: 'Lübeck -> Hamburg' },
      ],
      geometry: {
        type: 'LineString',
        coordinates: [
          [10.24, 53.68],
          [10.23, 53.67],
        ],
      },
    });

    expect(calculateDisruptionContentHash(reordered)).toBe(
      calculateDisruptionContentHash(original),
    );
  });

  it('changes when interpretation-relevant content changes', () => {
    const original = createDisruption();
    const changed = createDisruption({ delayMinutes: 19 });

    expect(calculateDisruptionContentHash(changed)).not.toBe(
      calculateDisruptionContentHash(original),
    );
  });

  it('preserves description and GeoJSON coordinate array ordering', () => {
    const original = createDisruption();
    const reorderedArrays = createDisruption({
      description: [
        { direction: 'Lübeck -> Hamburg', location: 'Ahrensburg' },
        'Stau',
      ],
      geometry: {
        type: 'LineString',
        coordinates: [
          [10.23, 53.67],
          [10.24, 53.68],
        ],
      },
    });

    expect(calculateDisruptionContentHash(reorderedArrays)).not.toBe(
      calculateDisruptionContentHash(original),
    );
  });

  it('excludes identity, raw payload and collection metadata', () => {
    const original = createDisruption();
    const metadataChanged = createDisruption({
      id: 'b6df11d8-042d-4f27-b7b3-6f038bca2ba5',
      source: 'another-source',
      providerId: 'another-provider-id',
      rawData: { changed: true },
      contentHash: 'b'.repeat(64),
      lifecycleStatus: 'RESOLVED',
      resolvedAt: new Date('2026-10-04T00:00:00.000Z'),
      ingestionMode: 'LIVE',
      capturedAt: new Date('2026-10-03T08:00:00.000Z'),
      lastSeenAt: new Date('2026-10-03T09:00:00.000Z'),
      lastLiveSeenAt: new Date('2026-10-03T09:00:00.000Z'),
      contentChangedAt: new Date('2026-10-03T08:00:00.000Z'),
    });

    expect(calculateDisruptionContentHash(metadataChanged)).toBe(
      calculateDisruptionContentHash(original),
    );
  });

  it.each(['startTimestamp', 'endTimestamp'] as const)(
    'distinguishes omitted %s values from explicit null values',
    (timestamp) => {
      const omitted = createDisruption({ [timestamp]: { kind: 'omitted' } });
      const explicitNull = createDisruption({
        [timestamp]: { kind: 'explicit-null' },
      });

      expect(calculateDisruptionContentHash(explicitNull)).not.toBe(
        calculateDisruptionContentHash(omitted),
      );
    },
  );
});
