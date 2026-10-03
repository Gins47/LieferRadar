import { getDatabaseUrl } from './database.config';

describe('getDatabaseUrl', () => {
  const environment = { ...process.env };

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, environment);
  });

  it('rejects a development database URL during tests without runner context', () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL =
      'postgresql://app:password@127.0.0.1:5432/lieferrader_db';
    delete process.env.LIEFERRADAR_TEST_CONTEXT;
    delete process.env.LIEFERRADAR_TEST_DATABASE_URL;
    delete process.env.LIEFERRADAR_TEST_DATABASE_NAME;

    expect(() => getDatabaseUrl()).toThrow(
      'test database configuration requires the ephemeral test runner',
    );
  });

  it('accepts a valid runner-owned database URL during tests', () => {
    process.env.NODE_ENV = 'test';
    process.env.LIEFERRADAR_TEST_CONTEXT = 'ephemeral-postgres';
    process.env.LIEFERRADAR_TEST_DATABASE_NAME = 'lieferradar_test_123';
    process.env.LIEFERRADAR_TEST_DATABASE_URL =
      'postgresql://test:password@127.0.0.1:54321/lieferradar_test_123';

    expect(getDatabaseUrl()).toBe(
      'postgresql://test:password@127.0.0.1:54321/lieferradar_test_123',
    );
  });
});
