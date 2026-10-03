export function getTestDatabaseUrl(): string {
  if (process.env.LIEFERRADAR_TEST_CONTEXT !== 'ephemeral-postgres') {
    throw new Error(
      'database integration tests require the ephemeral test runner',
    );
  }
  if (process.env.DATABASE_URL) {
    throw new Error('database integration tests must not use DATABASE_URL');
  }

  const value = process.env.LIEFERRADAR_TEST_DATABASE_URL;
  const expectedDatabase = process.env.LIEFERRADAR_TEST_DATABASE_NAME;
  if (!value || !expectedDatabase) {
    throw new Error('missing isolated database configuration');
  }

  const url = new URL(value);
  if (
    url.hostname !== '127.0.0.1' ||
    !url.port ||
    url.port === '5432' ||
    url.pathname !== `/${expectedDatabase}` ||
    !expectedDatabase.startsWith('lieferradar_test_')
  ) {
    throw new Error('refusing to connect to a non-isolated database');
  }

  return value;
}
