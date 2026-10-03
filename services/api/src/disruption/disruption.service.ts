import { Injectable, NotFoundException } from '@nestjs/common';
import { Disruption } from './model/disruption.model';
import {
  ActiveDisruptionQuery,
  DisruptionPage,
} from './repository/disruption-query';
import { PostgresDisruptionRepository } from './repository/postgres-disruption.repository';

@Injectable()
export class DisruptionService {
  constructor(
    private readonly disruptionRepository: PostgresDisruptionRepository,
  ) {}

  async getActiveDisruptions(
    query: Partial<ActiveDisruptionQuery>,
  ): Promise<DisruptionPage> {
    return this.disruptionRepository.findActiveDisruptions(query);
  }

  async getDisruption(id: string): Promise<Disruption> {
    const disruption = await this.disruptionRepository.findById(id);
    if (!disruption) {
      throw new NotFoundException(`Disruption ${id} not found`);
    }

    return disruption;
  }
}
