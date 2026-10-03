import { Injectable } from '@nestjs/common';
import { AutobahnClient } from './autobahn.client';
import { normalizeAutobahnWarning } from './autobahn-warning.mapper';
import {
  DisruptionObservationOutcome,
  PostgresDisruptionRepository,
} from '../../disruption/repository/postgres-disruption.repository';

export interface AutobahnCollectionFailure {
  providerId: string | null;
  message: string;
}

export interface AutobahnWarningCollectionResult {
  road: string;
  category: 'WARNING';
  mode: 'LIVE' | 'REPLAY';
  startedAt: Date;
  completedAt: Date;
  status: 'complete' | 'partial';
  collected: number;
  inserted: number;
  updated: number;
  unchanged: number;
  failures: AutobahnCollectionFailure[];
}

@Injectable()
export class AutobahnCollectionService {
  constructor(
    private readonly client: AutobahnClient,
    private readonly disruptionRepository: PostgresDisruptionRepository,
  ) {}

  async collectWarnings(
    road: string,
  ): Promise<AutobahnWarningCollectionResult> {
    const startedAt = new Date();
    const warnings = await this.client.fetchWarnings(road);
    return this.persistWarnings(warnings, road, startedAt, 'LIVE');
  }

  async replayWarnings(
    road: string,
    warnings: unknown[],
    observedAt: Date,
  ): Promise<AutobahnWarningCollectionResult> {
    return this.persistWarnings(warnings, road, observedAt, 'REPLAY');
  }

  private async persistWarnings(
    warnings: unknown[],
    road: string,
    startedAt: Date,
    mode: 'LIVE' | 'REPLAY',
  ): Promise<AutobahnWarningCollectionResult> {
    let inserted = 0;
    let updated = 0;
    let unchanged = 0;
    const failures: AutobahnCollectionFailure[] = [];

    for (const rawWarning of warnings) {
      try {
        const observation = normalizeAutobahnWarning(
          rawWarning,
          road,
          startedAt,
          mode,
        );
        const result =
          await this.disruptionRepository.upsertObservation(observation);
        this.countOutcome(result.outcome, {
          inserted: () => (inserted += 1),
          updated: () => (updated += 1),
          unchanged: () => (unchanged += 1),
        });
      } catch (error) {
        failures.push({
          providerId: this.providerId(rawWarning),
          message: error instanceof Error ? error.message : 'unknown error',
        });
      }
    }

    return {
      road,
      category: 'WARNING',
      mode,
      startedAt,
      completedAt: new Date(),
      status: failures.length === 0 ? 'complete' : 'partial',
      collected: warnings.length,
      inserted,
      updated,
      unchanged,
      failures,
    };
  }

  private countOutcome(
    outcome: DisruptionObservationOutcome,
    counters: {
      inserted: () => number;
      updated: () => number;
      unchanged: () => number;
    },
  ): void {
    if (outcome === 'NEW') {
      counters.inserted();
    } else if (outcome === 'CHANGED') {
      counters.updated();
    } else {
      counters.unchanged();
    }
  }

  private providerId(value: unknown): string | null {
    if (
      typeof value === 'object' &&
      value !== null &&
      'identifier' in value &&
      typeof value.identifier === 'string'
    ) {
      return value.identifier;
    }

    return null;
  }
}
