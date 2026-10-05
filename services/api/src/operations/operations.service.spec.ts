import { OperationsService } from './operations.service';

const shipment = (id: string, route: string[]) => ({
  id,
  pickupLocation: { city: id === 'SHP-002' ? 'Lübeck' : 'Stuttgart' },
  destination: { city: id === 'SHP-002' ? 'Hamburg' : 'Munich' },
  plannedRoute: route,
  status: 'PLANNED',
  pickupAt: new Date('2026-10-03T06:30:00.000Z'),
  plannedDeliveryAt: new Date('2026-10-03T08:30:00.000Z'),
});

describe('OperationsService', () => {
  function createService() {
    const shipments = {
      getShipments: jest
        .fn()
        .mockResolvedValue([
          shipment('SHP-001', ['A8']),
          shipment('SHP-002', ['A1']),
        ]),
    };
    const demo = {
      getShipmentScenario: jest
        .fn<
          Promise<{
            operatorReview: {
              state: string;
              reason: string;
              needsAttention: boolean;
              evidence: { checks: Record<string, unknown> };
            };
          }>,
          [string]
        >()
        .mockResolvedValue({
          operatorReview: {
            state: 'NEEDS_REVIEW',
            reason: 'positive evidence',
            needsAttention: true,
            evidence: { checks: {} },
          },
        }),
    };
    const disruptions = {
      findLiveWarnings: jest.fn().mockResolvedValue({
        items: [],
        page: 1,
        limit: 20,
        total: 2,
      }),
    };
    return {
      service: new OperationsService(
        shipments as never,
        demo as never,
        disruptions as never,
      ),
      demo,
      disruptions,
    };
  }

  it('keeps unevaluated shipments distinct and counts only accepted attention scenarios', async () => {
    const { service } = createService();

    await expect(
      service.getShipments(new Date('2026-10-05T10:00:00.000Z')),
    ).resolves.toMatchObject({
      totalShipments: 2,
      needsAttentionCount: 1,
      relevantLiveWarningCount: 2,
      shipmentsRequiringAttention: [{ shipment: { id: 'SHP-002' } }],
      otherShipments: [
        {
          shipment: { id: 'SHP-001' },
          review: { state: 'NOT_EVALUATED', needsAttention: false },
        },
      ],
    });
  });

  it('shows an unavailable approved scenario without treating it as unaffected', async () => {
    const { service, demo } = createService();
    demo.getShipmentScenario.mockRejectedValue(new Error('not prepared'));

    const result = await service.getShipments();
    expect(result.needsAttentionCount).toBe(0);
    const scenario = result.otherShipments.find(
      (view) => view.shipment.id === 'SHP-002',
    );
    expect(scenario?.review.state).toBe('SCENARIO_UNAVAILABLE');
    expect(scenario?.review.needsAttention).toBe(false);
  });

  it('uses Berlin calendar days, saved shipment roads and independent pagination for LIVE warnings', async () => {
    const { service, disruptions } = createService();
    disruptions.findLiveWarnings.mockResolvedValue({
      items: [
        {
          id: 'live-warning',
          queriedRoad: 'A1',
          title: 'A1 warning',
          description: ['provider text'],
          subtitle: 'Lübeck -> Hamburg',
          startTimestamp: { kind: 'omitted' },
          lastLiveSeenAt: new Date('2026-10-05T00:10:00.000Z'),
          source: 'autobahn',
          ingestionMode: 'LIVE',
        },
      ],
      page: 2,
      limit: 1,
      total: 3,
    });

    await expect(
      service.getWarnings(
        { page: 2, limit: 1 },
        new Date('2026-10-04T22:30:00.000Z'),
      ),
    ).resolves.toMatchObject({
      page: 2,
      limit: 1,
      total: 3,
      items: [{ road: 'A1', ingestionMode: 'LIVE' }],
    });
    expect(disruptions.findLiveWarnings).toHaveBeenCalledWith({
      roads: ['A8', 'A1'],
      observedOn: '2026-10-05',
      page: 2,
      limit: 1,
    });
  });
});
