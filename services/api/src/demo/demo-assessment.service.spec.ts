import {
  BadGatewayException,
  ConflictException,
  GatewayTimeoutException,
} from '@nestjs/common';
import {
  AiAssessmentProviderError,
  AiAssessmentTimeoutError,
} from '../integrations/ai/disruption-assessment.client';
import { DemoAssessmentService } from './demo-assessment.service';

function scenario(revision = 1, hash = 'a'.repeat(64)) {
  return {
    shipment: {},
    vehicle: { vehicleId: 'VEH-DEMO-002', revision },
    warning: { id: 'warning-1', contentHash: hash },
  };
}

function evidence(excluded = false) {
  return {
    excluded,
    exclusionReasons: excluded ? ['direction'] : [],
    request: {
      assessmentId: 'assessment-1',
      disruption: { evidenceId: 'warning-1' },
      checks: {
        geographic: { id: 'check-geographic' },
        direction: { id: 'check-direction' },
        routePosition: { id: 'check-route-position' },
        timing: { id: 'check-timing' },
      },
      limitations: [{ id: 'limitation-1' }],
    },
  };
}

function response(overrides: Record<string, unknown> = {}) {
  return {
    assessmentId: 'assessment-1',
    operatorMessage: 'Review the warning.',
    supportingEvidence: [
      {
        factIds: [
          'warning-1',
          'check-geographic',
          'check-direction',
          'check-route-position',
          'check-timing',
          'limitation-1',
        ],
        explanation: 'Known facts.',
      },
    ],
    missingEvidence: [],
    uncertainty: [],
    possibleConsequences: [],
    recommendedActions: [
      {
        action: 'MONITOR',
        rationale: 'Review manually.',
        requiresHumanReview: true,
      },
    ],
    ...overrides,
  };
}

describe('DemoAssessmentService', () => {
  function create(
    options: {
      excluded?: boolean;
      current?: ReturnType<typeof scenario>;
      aiError?: Error;
      aiResponse?: ReturnType<typeof response>;
    } = {},
  ) {
    const initial = scenario();
    const demo = {
      getPreparedScenario: jest
        .fn()
        .mockResolvedValueOnce(initial)
        .mockResolvedValue(options.current ?? initial),
    };
    const evidenceService = {
      prepare: jest.fn().mockReturnValue(evidence(options.excluded)),
    };
    const ai = options.aiError
      ? { assess: jest.fn().mockRejectedValue(options.aiError) }
      : {
          assess: jest.fn().mockResolvedValue(options.aiResponse ?? response()),
        };
    return {
      service: new DemoAssessmentService(
        demo as never,
        evidenceService as never,
        ai,
      ),
      demo,
      evidenceService,
      ai,
    };
  }

  it('returns deterministic exclusion without calling Python', async () => {
    const { service, ai } = create({ excluded: true });
    await expect(
      service.assess('SHP-002', { expectedRevision: 1 }),
    ).resolves.toMatchObject({ outcome: 'EXCLUDED' });
    expect(ai.assess).not.toHaveBeenCalled();
  });

  it('returns a validated assessment and binds it to current state', async () => {
    const { service, ai } = create();
    await expect(
      service.assess('SHP-002', { expectedRevision: 1 }),
    ).resolves.toMatchObject({
      outcome: 'ASSESSED',
      assessment: { assessmentId: 'assessment-1' },
    });
    expect(ai.assess).toHaveBeenCalledTimes(1);
  });

  it('rejects a stale revision, changed vehicle state, or changed warning after reasoning', async () => {
    const stale = create();
    await expect(
      stale.service.assess('SHP-002', { expectedRevision: 0 }),
    ).rejects.toBeInstanceOf(ConflictException);

    const changed = create({ current: scenario(2) });
    await expect(
      changed.service.assess('SHP-002', { expectedRevision: 1 }),
    ).rejects.toBeInstanceOf(ConflictException);

    const changedWarning = create({ current: scenario(1, 'b'.repeat(64)) });
    await expect(
      changedWarning.service.assess('SHP-002', { expectedRevision: 1 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects invalid evidence coverage and preserves evidence on unavailable AI responses', async () => {
    const invalid = create({
      aiResponse: response({
        supportingEvidence: [
          { factIds: ['warning-1'], explanation: 'Incomplete.' },
        ],
      }),
    });
    await expect(
      invalid.service.assess('SHP-002', { expectedRevision: 1 }),
    ).rejects.toMatchObject({ status: 502 });

    const timeout = create({
      aiError: new AiAssessmentTimeoutError('timeout'),
    });
    await expect(
      timeout.service.assess('SHP-002', { expectedRevision: 1 }),
    ).rejects.toBeInstanceOf(GatewayTimeoutException);

    const unavailable = create({
      aiError: new AiAssessmentProviderError('provider failed'),
    });
    await expect(
      unavailable.service.assess('SHP-002', { expectedRevision: 1 }),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
