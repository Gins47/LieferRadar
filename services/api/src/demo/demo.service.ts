import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Disruption } from '../disruption/model/disruption.model';
import { PostgresDisruptionRepository } from '../disruption/repository/postgres-disruption.repository';
import { ShipmentService } from '../shipment/shipment.service';
import {
  DEMO_SHIPMENT_ID,
  DEMO_START_AT,
  SELECTED_WARNING_PROVIDER_ID,
  SELECTED_WARNING_SOURCE,
} from './demo-preparation.service';
import { DemoVehicleState } from './model/demo-vehicle-state.model';
import { DemoVehiclePositionRequest } from './demo-position.dto';
import { PostgresDemoVehicleRepository } from './repository/postgres-demo-vehicle.repository';
import { LuebeckHamburgRouteService } from './route/luebeck-hamburg-route.service';

export const NEAR_DISRUPTION_ELAPSED_SECONDS = 3_840;

type DemoPositionName = DemoVehiclePositionRequest['position'];

interface DemoPositionTarget {
  elapsedSeconds: number;
  simulatedAt: Date;
}

function targetForPosition(position: DemoPositionName): DemoPositionTarget {
  const elapsedSeconds =
    position === 'START' ? 0 : NEAR_DISRUPTION_ELAPSED_SECONDS;

  return {
    elapsedSeconds,
    simulatedAt: new Date(DEMO_START_AT.getTime() + elapsedSeconds * 1_000),
  };
}

function mapWarning(warning: Disruption) {
  return {
    id: warning.id,
    source: warning.source,
    providerId: warning.providerId,
    queriedRoad: warning.queriedRoad,
    title: warning.title,
    subtitle: warning.subtitle,
    descriptions: warning.description,
    startTimestamp: warning.startTimestamp,
    endTimestamp: warning.endTimestamp,
    delayMinutes: warning.delayMinutes,
    geometry: warning.geometry,
    ingestionMode: warning.ingestionMode,
    capturedAt: warning.capturedAt,
  };
}

@Injectable()
export class DemoService {
  constructor(
    private readonly shipments: ShipmentService,
    private readonly disruptions: PostgresDisruptionRepository,
    private readonly vehicles: PostgresDemoVehicleRepository,
    private readonly route: LuebeckHamburgRouteService,
  ) {}

  async getShipmentScenario(shipmentId: string) {
    const { shipment, vehicle, warning } =
      await this.getPreparedScenario(shipmentId);
    const route = this.route.getRoute();

    return {
      shipment,
      vehicle,
      route: {
        routeHash: route.routeHash,
        coordinates: route.coordinates,
        provenance: route.provenance,
      },
      warning: mapWarning(warning),
    };
  }

  async setVehiclePosition(
    shipmentId: string,
    request: DemoVehiclePositionRequest,
  ) {
    const { vehicle } = await this.getPreparedScenario(shipmentId);
    const target = targetForPosition(request.position);
    const updated = await this.vehicles.updatePositionIfRevision(
      vehicle.vehicleId,
      request.expectedRevision,
      {
        elapsedSeconds: target.elapsedSeconds,
        position: this.route.positionAtElapsedSeconds(target.elapsedSeconds),
        simulatedAt: target.simulatedAt,
      },
    );

    if (!updated) {
      throw new ConflictException(
        'demo vehicle state has changed; refresh and retry',
      );
    }

    return updated;
  }

  async getPreparedScenario(shipmentId: string): Promise<{
    shipment: Awaited<ReturnType<ShipmentService['getShipment']>>;
    vehicle: DemoVehicleState;
    warning: Disruption;
  }> {
    if (shipmentId !== DEMO_SHIPMENT_ID) {
      throw new NotFoundException('demo shipment not found');
    }

    const [shipment, vehicle, warning] = await Promise.all([
      this.shipments.getShipment(shipmentId),
      this.vehicles.findByShipmentId(shipmentId),
      this.disruptions.findByProviderIdentity(
        SELECTED_WARNING_SOURCE,
        SELECTED_WARNING_PROVIDER_ID,
      ),
    ]);

    if (!vehicle) {
      throw new ConflictException('demo scenario has not been prepared');
    }
    if (vehicle.routeHash !== this.route.getRoute().routeHash) {
      throw new ConflictException(
        'demo vehicle state has an incompatible route',
      );
    }
    if (!warning) {
      throw new ConflictException(
        'selected historical replay warning is unavailable',
      );
    }
    if (warning.ingestionMode !== 'REPLAY') {
      throw new ConflictException(
        'selected historical replay warning is unavailable because newer LIVE state is persisted',
      );
    }

    return { shipment, vehicle, warning };
  }
}
