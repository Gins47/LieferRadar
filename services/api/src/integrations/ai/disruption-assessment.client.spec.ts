import {
  AiAssessmentInvalidOutputError,
  AiAssessmentProviderError,
  DisruptionAssessmentClient,
} from './disruption-assessment.client';

const request = {
  assessmentId: 'assessment-1',
  shipment: {
    id: 'SHP-002',
    pickupCity: 'Lübeck',
    destinationCity: 'Hamburg',
    pickupAt: '2026-10-03T06:30:00.000Z',
    plannedDeliveryAt: '2026-10-03T08:30:00.000Z',
  },
  vehicle: {
    id: 'VEH-DEMO-002',
    simulated: true as const,
    simulatedAt: '2026-10-03T07:34:00.000Z',
  },
  disruption: {
    evidenceId: 'warning-1',
    source: 'autobahn',
    providerId: 'provider-1',
    ingestionMode: 'REPLAY' as const,
    capturedAt: '2026-10-03T07:00:00.000Z',
    queriedRoad: 'A1',
    title: 'Warning',
    subtitle: null,
    descriptions: [],
    startTimestamp: {
      kind: 'value' as const,
      value: '2026-10-03T06:53:00.000Z',
    },
    endTimestamp: { kind: 'omitted' as const },
    delayMinutes: 18,
  },
  checks: {
    geographic: {
      id: 'check-geographic',
      state: 'NEAR_REMAINING_ROUTE' as const,
      distanceMetres: 1,
      toleranceMetres: 25,
    },
    direction: { id: 'check-direction', state: 'COMPATIBLE' as const },
    routePosition: {
      id: 'check-route-position',
      state: 'AHEAD_OR_ALONGSIDE' as const,
    },
    timing: { id: 'check-timing', state: 'POSSIBLE' as const },
  },
  limitations: [],
};

describe('DisruptionAssessmentClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('posts validated version 1 evidence and validates the response', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          assessmentId: 'assessment-1',
          operatorMessage: 'Review the warning.',
          supportingEvidence: [
            { factIds: ['warning-1'], explanation: 'Reported warning.' },
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
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    await expect(
      new DisruptionAssessmentClient().assess(request),
    ).resolves.toMatchObject({
      assessmentId: 'assessment-1',
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('reports provider and invalid-output failures explicitly', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response('unavailable', { status: 502 }));
    await expect(
      new DisruptionAssessmentClient().assess(request),
    ).rejects.toBeInstanceOf(AiAssessmentProviderError);

    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response('{}', { status: 200 }));
    await expect(
      new DisruptionAssessmentClient().assess(request),
    ).rejects.toBeInstanceOf(AiAssessmentInvalidOutputError);
  });
});
