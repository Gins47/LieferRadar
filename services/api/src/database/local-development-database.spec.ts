import {
  assertLocalDevelopmentCommandAllowed,
  getLocalDevelopmentDatabaseUrl,
} from './local-development-database';

const originalEnvironment = { ...process.env };

function restoreEnvironment(): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnvironment)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, originalEnvironment);
}

describe('local development database guard', () => {
  afterEach(restoreEnvironment);

  it('accepts the configured local LieferRadar database', () => {
    process.env.DATABASE_URL =
      'postgresql://postgres:postgres@127.0.0.1:5432/lieferrader_db';

    expect(getLocalDevelopmentDatabaseUrl('demo preparation')).toBe(
      process.env.DATABASE_URL,
    );
  });

  it('allows commands only in explicit local development mode', () => {
    process.env.NODE_ENV = 'development';

    expect(() =>
      assertLocalDevelopmentCommandAllowed('demo preparation'),
    ).not.toThrow();
  });

  it.each([
    undefined,
    'postgresql://postgres:postgres@127.0.0.1:5432/lieferradar_demo_local',
    'postgresql://postgres:postgres@db.example.test:5432/lieferrader_db',
    'postgresql://postgres:postgres@127.0.0.1:5433/lieferrader_db',
  ])('rejects an unsafe configured database URL: %s', (databaseUrl) => {
    if (databaseUrl) {
      process.env.DATABASE_URL = databaseUrl;
    } else {
      delete process.env.DATABASE_URL;
    }

    expect(() => getLocalDevelopmentDatabaseUrl('demo preparation')).toThrow(
      /demo preparation/,
    );
  });

  it.each(['test', 'production', 'staging', undefined])(
    'refuses unsupported environment mode: %s',
    (nodeEnv) => {
      if (nodeEnv) {
        process.env.NODE_ENV = nodeEnv;
      } else {
        delete process.env.NODE_ENV;
      }

      expect(() =>
        assertLocalDevelopmentCommandAllowed('demo preparation'),
      ).toThrow(
        'demo preparation is only available in local development (NODE_ENV=development)',
      );
    },
  );

  it('refuses an isolated integration-test context', () => {
    process.env.NODE_ENV = 'development';
    process.env.LIEFERRADAR_TEST_CONTEXT = 'ephemeral-postgres';
    expect(() =>
      assertLocalDevelopmentCommandAllowed('demo preparation'),
    ).toThrow('demo preparation must use the isolated integration-test setup');
  });
});
