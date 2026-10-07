import { Injectable } from '@nestjs/common';
import { SUPPORTED_DEMO_SHIPMENT_IDS } from '../demo/demo-preparation.service';
import { DemoService } from '../demo/demo.service';
import { PostgresDisruptionRepository } from '../disruption/repository/postgres-disruption.repository';
import { ShipmentView } from '../logistics/model/shipment-view.model';
import { ShipmentService } from '../shipment/shipment.service';
import { OperationsWarningsQuery } from './operations-query.dto';

function berlinCalendarDate(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function shipmentSummary(shipment: ShipmentView) {
  return {
    id: shipment.id,
    pickupLocation: shipment.pickupLocation,
    destination: shipment.destination,
    plannedRoute: shipment.plannedRoute,
    status: shipment.status,
    pickupAt: shipment.pickupAt,
    plannedDeliveryAt: shipment.plannedDeliveryAt,
  };
}

function notEvaluatedReview() {
  return {
    state: 'NOT_EVALUATED' as const,
    reason:
      'No complete approved disruption-assessment scenario is configured for this shipment.',
    needsAttention: false,
  };
}

function scenarioUnavailableReview() {
  return {
    state: 'SCENARIO_UNAVAILABLE' as const,
    reason: 'The approved prepared demonstration scenario is unavailable.',
    needsAttention: false,
  };
}

function isSupportedPreparedShipment(shipmentId: string): boolean {
  return SUPPORTED_DEMO_SHIPMENT_IDS.some((id) => id === shipmentId);
}

function reviewWarning(
  warning: Awaited<ReturnType<DemoService['getShipmentScenario']>>['warning'],
) {
  return {
    evidenceId: `warning-${warning.id}`,
    source: warning.source,
    providerId: warning.providerId,
    ingestionMode: warning.ingestionMode,
    capturedAt: warning.capturedAt,
    queriedRoad: warning.queriedRoad,
    title: warning.title,
    subtitle: warning.subtitle ?? undefined,
    descriptions: warning.descriptions,
    startTimestamp: warning.startTimestamp,
    endTimestamp: warning.endTimestamp,
    delayMinutes: warning.delayMinutes ?? undefined,
  };
}

@Injectable()
export class OperationsService {
  constructor(
    private readonly shipments: ShipmentService,
    private readonly demo: DemoService,
    private readonly disruptions: PostgresDisruptionRepository,
  ) {}

  async getShipments(now = new Date()) {
    const shipments = await this.shipments.getShipments();
    const roads = [
      ...new Set(shipments.flatMap((shipment) => shipment.plannedRoute)),
    ];
    const liveWarnings = await this.disruptions.findLiveWarnings({
      roads,
      observedOn: berlinCalendarDate(now),
      page: 1,
      limit: 1,
    });
    const views = await Promise.all(
      shipments.map((shipment) => this.shipmentView(shipment)),
    );
    const needsAttention = views.filter((view) => view.review.needsAttention);

    return {
      totalShipments: shipments.length,
      needsAttentionCount: needsAttention.length,
      relevantLiveWarningCount: liveWarnings.total,
      shipmentsRequiringAttention: needsAttention,
      otherShipments: views.filter((view) => !view.review.needsAttention),
    };
  }

  async getShipment(shipmentId: string) {
    const shipment = await this.shipments.getShipment(shipmentId);
    if (!isSupportedPreparedShipment(shipment.id)) {
      return {
        shipment,
        review: notEvaluatedReview(),
        aiAssessmentAvailable: false,
      };
    }

    try {
      const scenario = await this.demo.getShipmentScenario(shipment.id);
      return {
        shipment,
        vehicle: scenario.vehicle,
        review: {
          state: scenario.operatorReview.state,
          reason: scenario.operatorReview.reason,
          needsAttention: scenario.operatorReview.needsAttention,
        },
        evidence: scenario.operatorReview.evidence,
        reviewWarning: reviewWarning(scenario.warning),
        aiAssessmentAvailable: scenario.operatorReview.state === 'NEEDS_REVIEW',
      };
    } catch {
      return {
        shipment,
        review: scenarioUnavailableReview(),
        aiAssessmentAvailable: false,
      };
    }
  }

  async getWarnings(query: OperationsWarningsQuery, now = new Date()) {
    const shipments = await this.shipments.getShipments();
    const roads = [
      ...new Set(shipments.flatMap((shipment) => shipment.plannedRoute)),
    ];
    const page = await this.disruptions.findLiveWarnings({
      roads,
      observedOn: berlinCalendarDate(now),
      ...query,
    });
    return {
      ...page,
      items: page.items.map((warning) => ({
        id: warning.id,
        road: warning.queriedRoad,
        title: warning.title,
        descriptions: warning.description,
        direction: warning.subtitle,
        startTimestamp: warning.startTimestamp,
        lastLiveSeenAt: warning.lastLiveSeenAt,
        source: warning.source,
        ingestionMode: warning.ingestionMode,
      })),
    };
  }

  private async shipmentView(shipment: ShipmentView) {
    if (!isSupportedPreparedShipment(shipment.id)) {
      return {
        shipment: shipmentSummary(shipment),
        review: notEvaluatedReview(),
        aiAssessmentAvailable: false,
      };
    }

    try {
      const scenario = await this.demo.getShipmentScenario(shipment.id);
      return {
        shipment: shipmentSummary(shipment),
        review: scenario.operatorReview,
        aiAssessmentAvailable: scenario.operatorReview.state === 'NEEDS_REVIEW',
      };
    } catch {
      return {
        shipment: shipmentSummary(shipment),
        review: scenarioUnavailableReview(),
        aiAssessmentAvailable: false,
      };
    }
  }
}
