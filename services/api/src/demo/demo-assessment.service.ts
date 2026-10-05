import { randomUUID } from 'node:crypto';
import {
  BadGatewayException,
  ConflictException,
  GatewayTimeoutException,
  Injectable,
} from '@nestjs/common';
import {
  AiAssessmentInvalidOutputError,
  AiAssessmentProviderError,
  AiAssessmentTimeoutError,
  DisruptionAssessmentClient,
  DisruptionAssessmentRequest,
  DisruptionAssessmentResponse,
} from '../integrations/ai/disruption-assessment.client';
import { DemoAssessmentRequest } from './demo-assessment.dto';
import {
  DemoAssessmentEvidence,
  DemoEvidenceService,
} from './demo-evidence.service';
import { DemoService } from './demo.service';

function publicEvidence(evidence: DemoAssessmentEvidence) {
  return {
    disruption: evidence.request.disruption,
    checks: evidence.request.checks,
    limitations: evidence.request.limitations,
  };
}

function validateAssessment(
  request: DisruptionAssessmentRequest,
  response: DisruptionAssessmentResponse,
): void {
  if (response.assessmentId !== request.assessmentId) {
    throw new AiAssessmentInvalidOutputError(
      'AI assessment ID did not match the request',
    );
  }
  const referenced = new Set(
    response.supportingEvidence.flatMap((item) => item.factIds),
  );
  const required = [
    request.disruption.evidenceId,
    request.checks.geographic.id,
    request.checks.direction.id,
    request.checks.routePosition.id,
    request.checks.timing.id,
    ...request.limitations.map((item) => item.id),
  ];
  if (required.some((id) => !referenced.has(id))) {
    throw new AiAssessmentInvalidOutputError(
      'AI assessment did not cite every required deterministic fact and limitation',
    );
  }
  if ([...referenced].some((id) => !required.includes(id))) {
    throw new AiAssessmentInvalidOutputError(
      'AI assessment cited an unknown evidence ID',
    );
  }
}

@Injectable()
export class DemoAssessmentService {
  constructor(
    private readonly demo: DemoService,
    private readonly evidenceService: DemoEvidenceService,
    private readonly ai: DisruptionAssessmentClient,
  ) {}

  async assess(shipmentId: string, input: DemoAssessmentRequest) {
    const initial = await this.demo.getPreparedScenario(shipmentId);
    if (initial.vehicle.revision !== input.expectedRevision) {
      throw new ConflictException(
        'demo vehicle state has changed; refresh and retry',
      );
    }

    const evidence = this.evidenceService.prepare(
      initial.shipment,
      initial.vehicle,
      initial.warning,
      randomUUID(),
    );
    if (evidence.excluded) {
      await this.assertCurrent(shipmentId, initial);
      return {
        outcome: 'EXCLUDED' as const,
        exclusionReasons: evidence.exclusionReasons,
        evidence: publicEvidence(evidence),
      };
    }

    let assessment: DisruptionAssessmentResponse;
    try {
      assessment = await this.ai.assess(evidence.request);
      validateAssessment(evidence.request, assessment);
    } catch (error) {
      const body = {
        message:
          error instanceof Error
            ? error.message
            : 'AI assessment is unavailable',
        assessmentUnavailable: true,
        evidence: publicEvidence(evidence),
      };
      if (error instanceof AiAssessmentTimeoutError) {
        throw new GatewayTimeoutException(body);
      }
      if (
        error instanceof AiAssessmentProviderError ||
        error instanceof AiAssessmentInvalidOutputError
      ) {
        throw new BadGatewayException(body);
      }
      throw error;
    }

    await this.assertCurrent(shipmentId, initial);
    return {
      outcome: 'ASSESSED' as const,
      evidence: publicEvidence(evidence),
      assessment,
    };
  }

  private async assertCurrent(
    shipmentId: string,
    initial: Awaited<ReturnType<DemoService['getPreparedScenario']>>,
  ): Promise<void> {
    const current = await this.demo.getPreparedScenario(shipmentId);
    if (
      current.vehicle.vehicleId !== initial.vehicle.vehicleId ||
      current.vehicle.revision !== initial.vehicle.revision ||
      current.warning.id !== initial.warning.id ||
      current.warning.contentHash !== initial.warning.contentHash
    ) {
      throw new ConflictException(
        'demo assessment is stale because authoritative state changed',
      );
    }
  }
}
