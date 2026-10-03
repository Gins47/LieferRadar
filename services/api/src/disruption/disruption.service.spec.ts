import { NotFoundException } from '@nestjs/common';
import { DisruptionService } from './disruption.service';
import { PostgresDisruptionRepository } from './repository/postgres-disruption.repository';

describe('DisruptionService', () => {
  it('returns a stored disruption', async () => {
    const disruption = { id: '8dcd1a63-6a66-4aa7-b28e-8cb457f82f31' };
    const repository = {
      findById: jest.fn().mockResolvedValue(disruption),
    } as unknown as PostgresDisruptionRepository;

    await expect(
      new DisruptionService(repository).getDisruption(disruption.id),
    ).resolves.toBe(disruption);
  });

  it('maps only an absent stored disruption to 404', async () => {
    const repository = {
      findById: jest.fn().mockResolvedValue(undefined),
    } as unknown as PostgresDisruptionRepository;

    await expect(
      new DisruptionService(repository).getDisruption('missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('propagates database failures', async () => {
    const failure = new Error('database unavailable');
    const repository = {
      findById: jest.fn().mockRejectedValue(failure),
    } as unknown as PostgresDisruptionRepository;

    await expect(
      new DisruptionService(repository).getDisruption('missing'),
    ).rejects.toBe(failure);
  });
});
