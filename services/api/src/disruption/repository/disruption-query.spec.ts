import { ZodError } from 'zod';
import {
  DEFAULT_DISRUPTION_LIMIT,
  DEFAULT_DISRUPTION_PAGE,
  parseActiveDisruptionQuery,
} from './disruption-query';

describe('parseActiveDisruptionQuery', () => {
  it('applies the approved defaults', () => {
    expect(parseActiveDisruptionQuery()).toEqual({
      dateField: 'startTimestamp',
      page: DEFAULT_DISRUPTION_PAGE,
      limit: DEFAULT_DISRUPTION_LIMIT,
    });
  });

  it('accepts filters, a calendar date and capture-time selection', () => {
    expect(
      parseActiveDisruptionQuery({
        queriedRoad: ' A1 ',
        category: ' WARNING ',
        date: '2026-10-03',
        dateField: 'capturedAt',
        page: 2,
        limit: 50,
      }),
    ).toEqual({
      queriedRoad: 'A1',
      category: 'WARNING',
      date: '2026-10-03',
      dateField: 'capturedAt',
      page: 2,
      limit: 50,
    });
  });

  it('accepts one-sided and bounded calendar-date ranges', () => {
    expect(parseActiveDisruptionQuery({ from: '2026-03-29' })).toMatchObject({
      from: '2026-03-29',
    });
    expect(
      parseActiveDisruptionQuery({
        from: '2026-10-03',
        to: '2026-10-05',
      }),
    ).toMatchObject({
      from: '2026-10-03',
      to: '2026-10-05',
    });
  });

  it.each([
    { date: '2026-2-03' },
    { date: '2026-02-29' },
    { date: '2026-13-01' },
    { date: 'not-a-date' },
  ])('rejects invalid calendar dates: %o', (query) => {
    expect(() => parseActiveDisruptionQuery(query)).toThrow(ZodError);
  });

  it.each([
    { date: '2026-10-03', from: '2026-10-01' },
    { date: '2026-10-03', to: '2026-10-05' },
    { date: '2026-10-03', from: '2026-10-01', to: '2026-10-05' },
  ])('rejects conflicting date inputs: %o', (query) => {
    expect(() => parseActiveDisruptionQuery(query)).toThrow(ZodError);
  });

  it('rejects reversed date ranges', () => {
    expect(() =>
      parseActiveDisruptionQuery({
        from: '2026-10-05',
        to: '2026-10-03',
      }),
    ).toThrow(ZodError);
  });

  it.each([
    { dateField: 'lastSeenAt' },
    { page: 0 },
    { page: 1.5 },
    { limit: 0 },
    { limit: 101 },
    { queriedRoad: '   ' },
    { category: '   ' },
  ])('rejects invalid query values: %o', (query) => {
    expect(() => parseActiveDisruptionQuery(query)).toThrow(ZodError);
  });
});
