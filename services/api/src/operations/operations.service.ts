import { Injectable } from '@nestjs/common';
import { DEMO_SHIPMENT_ID } from '../demo/demo-preparation.service';
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
    if (shipment.id !== DEMO_SHIPMENT_ID) {
      return {
        shipment: shipmentSummary(shipment),
        review: {
          state: 'NOT_EVALUATED',
          reason:
            'No complete approved disruption-assessment scenario is configured for this shipment.',
          needsAttention: false,
        },
      };
    }

    try {
      const scenario = await this.demo.getShipmentScenario(shipment.id);
      return {
        shipment: shipmentSummary(shipment),
        review: scenario.operatorReview,
      };
    } catch {
      return {
        shipment: shipmentSummary(shipment),
        review: {
          state: 'SCENARIO_UNAVAILABLE',
          reason: 'The approved SHP-002 demonstration scenario is unavailable.',
          needsAttention: false,
        },
      };
    }
  }
}
