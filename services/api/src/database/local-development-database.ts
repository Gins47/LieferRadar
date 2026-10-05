function isLocalDevelopmentDatabase(url: URL): boolean {
  return (
    ['postgres:', 'postgresql:'].includes(url.protocol) &&
    ['127.0.0.1', 'localhost'].includes(url.hostname) &&
    url.port === '5432' &&
    url.pathname === '/lieferrader_db'
  );
}

export function getLocalDevelopmentDatabaseUrl(operation: string): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(`DATABASE_URL is required for ${operation}`);
  }

  try {
    if (!isLocalDevelopmentDatabase(new URL(databaseUrl))) {
      throw new Error(
        `${operation} requires the configured local development database`,
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(operation)) {
      throw error;
    }
    throw new Error(
      `${operation} requires a valid local development DATABASE_URL`,
    );
  }

  return databaseUrl;
}

export function assertLocalDevelopmentCommandAllowed(operation: string): void {
  if (process.env.LIEFERRADAR_TEST_CONTEXT) {
    throw new Error(
      `${operation} must use the isolated integration-test setup in test mode`,
    );
  }
  if (process.env.NODE_ENV !== 'development') {
    throw new Error(
      `${operation} is only available in local development (NODE_ENV=development)`,
    );
  }
}
