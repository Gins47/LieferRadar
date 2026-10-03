import { Injectable } from '@nestjs/common';
import { z } from 'zod';

const DEFAULT_AUTOBANH_API_BASE_URL = 'https://verkehr.autobahn.de/o/autobahn/';
const REQUEST_TIMEOUT_MS = 5_000;
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 250;

const warningEnvelopeSchema = z
  .object({ warning: z.array(z.unknown()) })
  .passthrough();

export class AutobahnProviderError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    readonly retryable = false,
  ) {
    super(message);
  }
}

function apiBaseUrl(): URL {
  const configured =
    process.env.AUTOBANH_API_BASE_URL ?? DEFAULT_AUTOBANH_API_BASE_URL;

  try {
    const url = new URL(configured);
    if (url.protocol !== 'https:' || url.username || url.password) {
      throw new Error('must use an HTTPS URL without credentials');
    }
    return url.pathname.endsWith('/') ? url : new URL(`${url.toString()}/`);
  } catch (error) {
    throw new AutobahnProviderError(
      `Invalid Autobahn API base URL: ${
        error instanceof Error ? error.message : 'unknown error'
      }`,
    );
  }
}

function warningUrl(road: string): URL {
  return new URL(`${encodeURIComponent(road)}/services/warning`, apiBaseUrl());
}

function retryableStatus(statusCode: number): boolean {
  return statusCode === 429 || (statusCode >= 500 && statusCode <= 504);
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

@Injectable()
export class AutobahnClient {
  async fetchWarnings(road: string): Promise<unknown[]> {
    let lastError: AutobahnProviderError | undefined;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(warningUrl(road), {
          headers: { accept: 'application/json' },
          redirect: 'error',
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new AutobahnProviderError(
            `Autobahn warning request failed with HTTP ${response.status}`,
            response.status,
            retryableStatus(response.status),
          );
        }

        let body: unknown;
        try {
          body = await response.json();
        } catch {
          throw new AutobahnProviderError(
            'Autobahn warning response was not valid JSON',
          );
        }

        const parsed = warningEnvelopeSchema.safeParse(body);
        if (!parsed.success) {
          throw new AutobahnProviderError(
            'Autobahn warning response did not contain a warning array',
          );
        }

        return parsed.data.warning;
      } catch (error) {
        lastError =
          error instanceof AutobahnProviderError
            ? error
            : new AutobahnProviderError(
                controller.signal.aborted
                  ? 'Autobahn warning request timed out'
                  : 'Autobahn warning request failed',
                undefined,
                true,
              );
      } finally {
        clearTimeout(timeout);
      }

      if (!lastError.retryable || attempt === MAX_ATTEMPTS) {
        throw lastError;
      }
      await wait(RETRY_DELAY_MS);
    }

    throw (
      lastError ?? new AutobahnProviderError('Autobahn warning request failed')
    );
  }
}
