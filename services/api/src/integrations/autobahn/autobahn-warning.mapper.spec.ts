import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeAutobahnWarning } from './autobahn-warning.mapper';

const warnings = (
  JSON.parse(
    readFileSync(
      join(process.cwd(), 'test/fixtures/autobahn/a1-warnings-2026-10.03.json'),
      'utf8',
    ),
  ) as { warning: unknown[] }
).warning;

describe('normalizeAutobahnWarning', () => {
  it('preserves authentic A1 warning evidence in an application disruption', () => {
    const source = warnings[1]!;
    const observedAt = new Date('2026-10-04T08:00:00.000Z');

    const result = normalizeAutobahnWarning(source, 'A1', observedAt);

    expect(result).toMatchObject({
      source: 'autobahn',
      providerId: 'INRIX--vi-avl.2026-10-03_06-53-00-000_003.de0',
      category: 'WARNING',
      disruptionType: 'QUEUING_TRAFFIC',
      queriedRoad: 'A1',
      title: 'A1 | Bargteheide - Ahrensburg',
      subtitle: ' Lübeck -> Hamburg',
      abnormalTrafficType: 'QUEUING_TRAFFIC',
      delayMinutes: 18,
      averageSpeedKmh: null,
      startTimestamp: {
        kind: 'value',
        value: new Date('2026-10-03T06:53:00.000Z'),
      },
      endTimestamp: { kind: 'omitted' },
      ingestionMode: 'LIVE',
      capturedAt: observedAt,
      lastSeenAt: observedAt,
    });
    expect(result.rawData).toEqual(source);
    expect(result.description).toEqual(
      (source as { description: unknown }).description,
    );
    expect(result.geometry).toEqual((source as { geometry: unknown }).geometry);
  });

  it('keeps an explicit-null timestamp distinct from an omitted timestamp', () => {
    const source = {
      ...(warnings[1] as Record<string, unknown>),
      startTimestamp: null,
      endTimestamp: null,
    };

    const result = normalizeAutobahnWarning(
      source,
      'A1',
      new Date('2026-10-04T08:00:00.000Z'),
    );

    expect(result.startTimestamp).toEqual({ kind: 'explicit-null' });
    expect(result.endTimestamp).toEqual({ kind: 'explicit-null' });
  });

  it('rejects a warning without the required provider identity', () => {
    expect(() =>
      normalizeAutobahnWarning(
        { title: 'missing identifier', description: [] },
        'A1',
        new Date('2026-10-04T08:00:00.000Z'),
      ),
    ).toThrow();
  });
});
