import { Injectable } from '@nestjs/common';
import { z } from 'zod';

const isoInstantSchema = z.string().datetime({ offset: true });
const providerTimestampSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('omitted') }).strict(),
  z.object({ kind: z.literal('explicit-null') }).strict(),
  z.object({ kind: z.literal('value'), value: isoInstantSchema }).strict(),
]);

const evidenceReferenceSchema = z.object({ id: z.string().min(1).max(100) });

export const disruptionAssessmentRequestSchema = z
  .object({
    assessmentId: z.string().min(1).max(100),
    shipment: z
      .object({
        id: z.string().min(1).max(100),
        pickupCity: z.string().min(1).max(100),
        destinationCity: z.string().min(1).max(100),
        pickupAt: isoInstantSchema,
        plannedDeliveryAt: isoInstantSchema,
      })
      .strict(),
    vehicle: z
      .object({
        id: z.string().min(1).max(100),
        simulated: z.literal(true),
        simulatedAt: isoInstantSchema,
      })
      .strict(),
    disruption: z
      .object({
        evidenceId: z.string().min(1).max(100),
        source: z.string().min(1).max(100),
        providerId: z.string().min(1).max(300),
        ingestionMode: z.enum(['LIVE', 'REPLAY']),
        capturedAt: isoInstantSchema,
        queriedRoad: z.string().min(1).max(20),
        title: z.string().min(1).max(500),
        subtitle: z.string().max(500).nullable(),
        descriptions: z.array(z.string()).max(20),
        startTimestamp: providerTimestampSchema,
        endTimestamp: providerTimestampSchema,
        delayMinutes: z.number().int().nonnegative().nullable(),
      })
      .strict(),
    checks: z
      .object({
        geographic: evidenceReferenceSchema
          .extend({
            state: z.enum(['NEAR_REMAINING_ROUTE', 'DISTANT', 'UNKNOWN']),
            distanceMetres: z.number().nonnegative().nullable(),
            toleranceMetres: z.number().positive().nullable(),
          })
          .strict(),
        direction: evidenceReferenceSchema
          .extend({ state: z.enum(['COMPATIBLE', 'CONFLICTING', 'UNKNOWN']) })
          .strict(),
        routePosition: evidenceReferenceSchema
          .extend({
            state: z.enum(['AHEAD_OR_ALONGSIDE', 'BEHIND', 'UNKNOWN']),
          })
          .strict(),
        timing: evidenceReferenceSchema
          .extend({ state: z.enum(['POSSIBLE', 'CONFLICTING', 'UNKNOWN']) })
          .strict(),
      })
      .strict(),
    limitations: z
      .array(
        evidenceReferenceSchema
          .extend({ description: z.string().min(1).max(1_000) })
          .strict(),
      )
      .max(20),
  })
  .strict()
  .superRefine((value, context) => {
    const geographic = value.checks.geographic;
    const known = geographic.state !== 'UNKNOWN';
    if (
      (known &&
        (geographic.distanceMetres === null ||
          geographic.toleranceMetres === null)) ||
      (!known &&
        (geographic.distanceMetres !== null ||
          geographic.toleranceMetres !== null))
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['checks', 'geographic'],
        message: 'geographic state and distance evidence are inconsistent',
      });
    }
  });

const recommendedActionSchema = z
  .object({
    action: z.enum(['MONITOR', 'VERIFY_INFORMATION', 'REVIEW_PLAN']),
    rationale: z.string().min(1).max(1_000),
    requiresHumanReview: z.literal(true),
  })
  .strict();

export const disruptionAssessmentResponseSchema = z
  .object({
    assessmentId: z.string().min(1).max(100),
    operatorMessage: z.string().min(1).max(2_000),
    supportingEvidence: z
      .array(
        z
          .object({
            factIds: z.array(z.string().min(1).max(100)).min(1).max(10),
            explanation: z.string().min(1).max(1_000),
          })
          .strict(),
      )
      .min(1)
      .max(20),
    missingEvidence: z.array(z.string()).max(20),
    uncertainty: z.array(z.string()).max(20),
    possibleConsequences: z.array(z.string()).max(10),
    recommendedActions: z.array(recommendedActionSchema).min(1).max(5),
  })
  .strict();

export type DisruptionAssessmentRequest = z.infer<
  typeof disruptionAssessmentRequestSchema
>;
export type DisruptionAssessmentResponse = z.infer<
  typeof disruptionAssessmentResponseSchema
>;

export class AiAssessmentTimeoutError extends Error {}
export class AiAssessmentProviderError extends Error {}
export class AiAssessmentInvalidOutputError extends Error {}

const ASSESSMENT_TIMEOUT_MS = 30_000;

function assessmentUrl(): URL {
  const configured = process.env.AI_SERVICE_BASE_URL ?? 'http://127.0.0.1:8000';
  try {
    const base = new URL(configured);
    if (
      !['http:', 'https:'].includes(base.protocol) ||
      base.username ||
      base.password
    ) {
      throw new Error('must be an HTTP(S) URL without credentials');
    }
    return new URL('/analysis/disruption', base);
  } catch (error) {
    throw new AiAssessmentProviderError(
      `invalid AI service URL: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }
}

@Injectable()
export class DisruptionAssessmentClient {
  async assess(
    input: DisruptionAssessmentRequest,
  ): Promise<DisruptionAssessmentResponse> {
    const request = disruptionAssessmentRequestSchema.parse(input);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ASSESSMENT_TIMEOUT_MS);

    try {
      const response = await fetch(assessmentUrl(), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new AiAssessmentProviderError(
          `AI assessment request failed with HTTP ${response.status}`,
        );
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new AiAssessmentInvalidOutputError(
          'AI assessment response was not valid JSON',
        );
      }
      const parsed = disruptionAssessmentResponseSchema.safeParse(body);
      if (!parsed.success) {
        throw new AiAssessmentInvalidOutputError(
          'AI assessment response did not match version 1 schema',
        );
      }
      return parsed.data;
    } catch (error) {
      if (controller.signal.aborted) {
        throw new AiAssessmentTimeoutError('AI assessment timed out');
      }
      if (
        error instanceof AiAssessmentProviderError ||
        error instanceof AiAssessmentInvalidOutputError
      ) {
        throw error;
      }
      throw new AiAssessmentProviderError('AI assessment is unavailable');
    } finally {
      clearTimeout(timeout);
    }
  }
}
