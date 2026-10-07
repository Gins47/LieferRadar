import { NotFoundException } from '@nestjs/common';
import { OperationsService } from './operations.service';

const supportedIds = new Set(['SHP-002', 'SHP-003', 'SHP-004']);

function shipment(id: string, route = ['A1']) {
  const isPrepared = supportedIds.has(id);
  return {
    id,
    supplier: {
      id: isPrepared ? 'SUP-002' : 'SUP-001',
      name: 'Supplier',
      location: {
        city: isPrepared ? 'Lübeck' : 'Stuttgart',
        countryCode: 'DE',
      },
    },
    product: { id: 'PROD-001', sku: 'SKU', name: 'Product' },
    quantity: 500,
    pickupLocation: {
      city: isPrepared ? 'Lübeck' : 'Stuttgart',
      countryCode: 'DE',
    },
    destination: { city: isPrepared ? 'Hamburg' : 'Munich', countryCode: 'DE' },
    plannedRoute: route,
    status: 'IN_TRANSIT',
    pickupAt: new Date('2026-10-03T06:30:00.000Z'),
    plannedDeliveryAt: new Date('2026-10-03T08:30:00.000Z'),
  };
}

function scenario(
  id: 'SHP-002' | 'SHP-003' | 'SHP-004',
  state: 'NEEDS_REVIEW' | 'EXCLUDED' | 'WARNING_NOT_YET_OBSERVED',
) {
  const needsAttention = state === 'NEEDS_REVIEW';
  return {
    shipment: shipment(id),
    vehicle: { vehicleId: `VEH-DEMO-${id.slice(-3)}`, revision: 0 },
    warning: {
      id: 'warning-003',
      source: 'autobahn',
      providerId: 'INRIX--vi-avl.2026-10-03_06-53-00-000_003.de0',
      ingestionMode: 'REPLAY',
      capturedAt: new Date('2026-10-03T07:00:00.000Z'),
      queriedRoad: 'A1',
      title: 'Congestion',
      subtitle: 'Lübeck -> Hamburg',
      descriptions: ['Provider traffic information'],
      startTimestamp: {
        kind: 'value',
        value: new Date('2026-10-03T06:53:00.000Z'),
      },
      endTimestamp: { kind: 'omitted' },
      delayMinutes: 18,
    },
    operatorReview: {
      state,
      reason: `${state} from deterministic evidence`,
      needsAttention,
      evidence: {
        checks: {
          geographic: {
            state: id === 'SHP-003' ? 'UNKNOWN' : 'NEAR_REMAINING_ROUTE',
          },
          direction: { state: 'COMPATIBLE' },
          routePosition: {
            state: id === 'SHP-003' ? 'BEHIND' : 'AHEAD_OR_ALONGSIDE',
          },
          timing: { state: 'POSSIBLE' },
        },
        limitations: [],
        excluded: state === 'EXCLUDED',
        exclusionReasons: state === 'EXCLUDED' ? ['routePosition'] : [],
      },
    },
  };
}

describe('OperationsService', () => {
  function createService() {
    const shipmentsById = new Map([
      ['SHP-001', shipment('SHP-001', ['A8'])],
      ['SHP-002', shipment('SHP-002')],
      ['SHP-003', shipment('SHP-003')],
      ['SHP-004', shipment('SHP-004')],
    ]);
    const shipments = {
      getShipments: jest.fn().mockResolvedValue([...shipmentsById.values()]),
      getShipment: jest.fn((id: string) => {
        const result = shipmentsById.get(id);
        return result
          ? Promise.resolve(result)
          : Promise.reject(new NotFoundException('shipment not found'));
      }),
    };
    const scenarios = new Map([
      ['SHP-002', scenario('SHP-002', 'NEEDS_REVIEW')],
      ['SHP-003', scenario('SHP-003', 'EXCLUDED')],
      ['SHP-004', scenario('SHP-004', 'WARNING_NOT_YET_OBSERVED')],
    ]);
    const demo = {
      getShipmentScenario: jest.fn((id: string) =>
        Promise.resolve(scenarios.get(id)),
      ),
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
      shipments,
      demo,
      disruptions,
    };
  }

  it('returns all persisted shipments with prepared reviews and no network call', async () => {
    const { service } = createService();
    const fetch = jest.spyOn(global, 'fetch');
    fetch.mockImplementation(jest.fn());

    try {
      const result = await service.getShipments(
        new Date('2026-10-05T10:00:00.000Z'),
      );
      expect(result).toMatchObject({
        totalShipments: 4,
        needsAttentionCount: 1,
        relevantLiveWarningCount: 2,
        shipmentsRequiringAttention: [
          {
            shipment: { id: 'SHP-002' },
            review: { state: 'NEEDS_REVIEW', needsAttention: true },
            aiAssessmentAvailable: true,
          },
        ],
      });
      expect(
        result.otherShipments.find((view) => view.shipment.id === 'SHP-001'),
      ).toMatchObject({
        review: { state: 'NOT_EVALUATED', needsAttention: false },
        aiAssessmentAvailable: false,
      });
      expect(
        result.otherShipments.find((view) => view.shipment.id === 'SHP-003'),
      ).toMatchObject({
        review: { state: 'EXCLUDED', needsAttention: false },
        aiAssessmentAvailable: false,
      });
      expect(
        result.otherShipments.find((view) => view.shipment.id === 'SHP-004'),
      ).toMatchObject({
        review: {
          state: 'WARNING_NOT_YET_OBSERVED',
          needsAttention: false,
        },
        aiAssessmentAvailable: false,
      });
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      fetch.mockRestore();
    }
  });

  it('returns the selected REPLAY warning in prepared detail and only offers AI for NEEDS_REVIEW', async () => {
    const { service } = createService();

    await expect(service.getShipment('SHP-002')).resolves.toMatchObject({
      shipment: { id: 'SHP-002' },
      vehicle: { vehicleId: 'VEH-DEMO-002' },
      review: { state: 'NEEDS_REVIEW' },
      evidence: {
        checks: {
          geographic: { state: 'NEAR_REMAINING_ROUTE' },
        },
      },
      reviewWarning: {
        evidenceId: 'warning-warning-003',
        source: 'autobahn',
        providerId: 'INRIX--vi-avl.2026-10-03_06-53-00-000_003.de0',
        ingestionMode: 'REPLAY',
        queriedRoad: 'A1',
      },
      aiAssessmentAvailable: true,
    });
    await expect(service.getShipment('SHP-003')).resolves.toMatchObject({
      shipment: { id: 'SHP-003' },
      vehicle: { vehicleId: 'VEH-DEMO-003' },
      review: { state: 'EXCLUDED' },
      evidence: { checks: { routePosition: { state: 'BEHIND' } } },
      aiAssessmentAvailable: false,
    });
    await expect(service.getShipment('SHP-004')).resolves.toMatchObject({
      shipment: { id: 'SHP-004' },
      vehicle: { vehicleId: 'VEH-DEMO-004' },
      review: { state: 'WARNING_NOT_YET_OBSERVED' },
      aiAssessmentAvailable: false,
    });
  });

  it('does not call the network while composing prepared shipment detail', async () => {
    const { service } = createService();
    const fetch = jest.spyOn(global, 'fetch');
    fetch.mockImplementation(jest.fn());

    try {
      await service.getShipment('SHP-002');
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      fetch.mockRestore();
    }
  });

  it('returns an unevaluated detail without a vehicle or evidence for ordinary shipments', async () => {
    const { service, demo } = createService();

    const result = await service.getShipment('SHP-001');
    expect(result).toMatchObject({
      shipment: { id: 'SHP-001' },
      review: { state: 'NOT_EVALUATED', needsAttention: false },
      aiAssessmentAvailable: false,
    });
    expect(result).not.toHaveProperty('reviewWarning');
    expect(demo.getShipmentScenario).not.toHaveBeenCalled();
  });

  it('preserves normal 404 behavior for missing shipment detail', async () => {
    const { service } = createService();

    await expect(service.getShipment('SHP-MISSING')).rejects.toBeInstanceOf(
      NotFoundException,
    );
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
