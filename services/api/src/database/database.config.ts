const testContext = 'ephemeral-postgres';

function getIsolatedTestDatabaseUrl(): string {
  if (process.env.LIEFERRADAR_TEST_CONTEXT !== testContext) {
    throw new Error(
      'test database configuration requires the ephemeral test runner',
    );
  }

  const value = process.env.LIEFERRADAR_TEST_DATABASE_URL;
  const expectedDatabase = process.env.LIEFERRADAR_TEST_DATABASE_NAME;
  if (!value || !expectedDatabase) {
    throw new Error('missing isolated test database configuration');
  }

  const url = new URL(value);
  if (
    url.hostname !== '127.0.0.1' ||
    !url.port ||
    url.port === '5432' ||
    url.pathname !== `/${expectedDatabase}` ||
    !expectedDatabase.startsWith('lieferradar_test_')
  ) {
    throw new Error('refusing to use a non-isolated test database');
  }

  return value;
}

export function getDatabaseUrl(): string {
  if (
    process.env.LIEFERRADAR_TEST_CONTEXT ||
    process.env.LIEFERRADAR_TEST_DATABASE_URL
  ) {
    return getIsolatedTestDatabaseUrl();
  }

  const value = process.env.DATABASE_URL;
  if (!value) {
    throw new Error('DATABASE_URL is required for database access');
  }

  return value;
}
