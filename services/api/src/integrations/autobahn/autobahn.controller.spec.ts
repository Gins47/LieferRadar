import { BadGatewayException, NotFoundException } from '@nestjs/common';
import { AutobahnProviderError } from './autobahn.client';
import { AutobahnCollectionService } from './autobahn-collection.service';
import { AutobahnController } from './autobahn.controller';

describe('AutobahnController', () => {
  const originalEnvironment = process.env;

  afterEach(() => {
    process.env = originalEnvironment;
  });

  it('does not enable manual synchronization by default', async () => {
    process.env = { ...originalEnvironment, NODE_ENV: 'development' };
    delete process.env.AUTOBANH_COLLECTION_ENABLED;
    const collectWarnings = jest.fn();
    const service = {
      collectWarnings,
    } as unknown as AutobahnCollectionService;

    await expect(
      new AutobahnController(service).collectWarnings({ road: 'A1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(collectWarnings).not.toHaveBeenCalled();
  });

  it('allows a local development demonstration when explicitly enabled', async () => {
    process.env = {
      ...originalEnvironment,
      NODE_ENV: 'development',
      AUTOBANH_COLLECTION_ENABLED: 'true',
    };
    const service = {
      collectWarnings: jest.fn().mockResolvedValue({ status: 'complete' }),
    } as unknown as AutobahnCollectionService;

    await expect(
      new AutobahnController(service).collectWarnings({ road: 'A1' }),
    ).resolves.toEqual({ status: 'complete' });
  });

  it('keeps manual synchronization disabled in production', async () => {
    process.env = {
      ...originalEnvironment,
      NODE_ENV: 'production',
      AUTOBANH_COLLECTION_ENABLED: 'true',
    };
    const service = {
      collectWarnings: jest.fn(),
    } as unknown as AutobahnCollectionService;

    await expect(
      new AutobahnController(service).collectWarnings({ road: 'A1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('maps provider failures without hiding application failures', async () => {
    process.env = {
      ...originalEnvironment,
      NODE_ENV: 'development',
      AUTOBANH_COLLECTION_ENABLED: 'true',
    };
    const service = {
      collectWarnings: jest
        .fn()
        .mockRejectedValue(new AutobahnProviderError('provider unavailable')),
    } as unknown as AutobahnCollectionService;

    await expect(
      new AutobahnController(service).collectWarnings({ road: 'A1' }),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
