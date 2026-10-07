import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { Disruption } from '../disruption/model/disruption.model';
import { PostgresDisruptionRepository } from '../disruption/repository/postgres-disruption.repository';
import { AutobahnCollectionService } from '../integrations/autobahn/autobahn-collection.service';
import {
  DemoPosition,
  DemoVehicleState,
  NewDemoVehicleState,
} from './model/demo-vehicle-state.model';
import { PostgresDemoVehicleRepository } from './repository/postgres-demo-vehicle.repository';
import { LuebeckHamburgRouteService } from './route/luebeck-hamburg-route.service';

export const DEMO_VEHICLE_ID = 'VEH-DEMO-002';
export const DEMO_SHIPMENT_ID = 'SHP-002';
export const DEMO_SHIPMENT_003_ID = 'SHP-003';
export const DEMO_SHIPMENT_004_ID = 'SHP-004';
export const DEMO_VEHICLE_003_ID = 'VEH-DEMO-003';
export const DEMO_VEHICLE_004_ID = 'VEH-DEMO-004';
export const SUPPORTED_DEMO_SHIPMENT_IDS = [
  DEMO_SHIPMENT_ID,
  DEMO_SHIPMENT_003_ID,
  DEMO_SHIPMENT_004_ID,
] as const;
export const SELECTED_WARNING_SOURCE = 'autobahn';
export const SELECTED_WARNING_PROVIDER_ID =
  'INRIX--vi-avl.2026-10-03_06-53-00-000_003.de0';
export const DEMO_START_AT = new Date('2026-10-03T06:30:00.000Z');
export const REPLAY_OBSERVED_AT = new Date('2026-10-03T07:00:00.000Z');
export const SHIPMENT_003_ELAPSED_SECONDS = 5_004;

interface PreparedDemoContext {
  shipmentId: string;
  vehicleId: string;
  driver: DemoVehicleState['driver'];
  elapsedSeconds: number;
  position: DemoPosition;
  simulatedAt: Date;
}

// Fixed vertices selected from the approved immutable A1 route fixture.
const preparedDemoContexts: readonly PreparedDemoContext[] = [
  {
    shipmentId: DEMO_SHIPMENT_ID,
    vehicleId: DEMO_VEHICLE_ID,
    driver: {
      name: 'Alex Demo',
      email: 'driver-shp002@example.invalid',
      phone: '+49 000 0000002',
    },
    elapsedSeconds: 0,
    position: [10.686606, 53.865509],
    simulatedAt: DEMO_START_AT,
  },
  {
    shipmentId: DEMO_SHIPMENT_003_ID,
    vehicleId: DEMO_VEHICLE_003_ID,
    driver: {
      name: 'Blake Demo',
      email: 'driver-shp003@example.invalid',
      phone: '+49 000 0000003',
    },
    elapsedSeconds: SHIPMENT_003_ELAPSED_SECONDS,
    position: [10.236442, 53.620842],
    simulatedAt: new Date('2026-10-03T07:53:24.000Z'),
  },
  {
    shipmentId: DEMO_SHIPMENT_004_ID,
    vehicleId: DEMO_VEHICLE_004_ID,
    driver: {
      name: 'Casey Demo',
      email: 'driver-shp004@example.invalid',
      phone: '+49 000 0000004',
    },
    elapsedSeconds: 0,
    position: [10.686606, 53.865509],
    simulatedAt: DEMO_START_AT,
  },
];

const warningFixturePath = join(
  process.cwd(),
  'test',
  'fixtures',
  'autobahn',
  'a1-warnings-2026-10.03.json',
);

interface WarningFixture {
  warning?: unknown;
}

export interface DemoPreparationResult {
  vehicle: DemoVehicleState;
  vehicles: readonly DemoVehicleState[];
  warning: Disruption;
}

function loadRecordedWarnings(): unknown[] {
  const fixture = JSON.parse(
    readFileSync(warningFixturePath, 'utf8'),
  ) as WarningFixture;
  if (!Array.isArray(fixture.warning)) {
    throw new Error('A1 warning fixture does not contain a warning array');
  }

  return fixture.warning;
}

function expectedVehicleState(
  context: PreparedDemoContext,
  route: LuebeckHamburgRouteService,
): NewDemoVehicleState {
  return {
    vehicleId: context.vehicleId,
    driver: context.driver,
    routeHash: route.getRoute().routeHash,
    elapsedSeconds: context.elapsedSeconds,
    position: context.position,
    simulatedAt: context.simulatedAt,
    revision: 0,
  };
}

function matchesApprovedVehicle(
  actual: DemoVehicleState,
  expected: NewDemoVehicleState,
): boolean {
  return (
    actual.vehicleId === expected.vehicleId &&
    actual.driver.name === expected.driver.name &&
    actual.driver.email === expected.driver.email &&
    actual.driver.phone === expected.driver.phone &&
    actual.routeHash === expected.routeHash
  );
}

@Injectable()
export class DemoPreparationService {
  constructor(
    private readonly autobahnCollection: AutobahnCollectionService,
    private readonly disruptions: PostgresDisruptionRepository,
    private readonly vehicles: PostgresDemoVehicleRepository,
    private readonly route: LuebeckHamburgRouteService,
  ) {}

  async prepare(): Promise<DemoPreparationResult> {
    const vehicles = await Promise.all(
      preparedDemoContexts.map((context) => this.prepareVehicle(context)),
    );
    const vehicle = vehicles[0];

    await this.autobahnCollection.replayWarnings(
      'A1',
      loadRecordedWarnings(),
      REPLAY_OBSERVED_AT,
    );

    const warning = await this.disruptions.findByProviderIdentity(
      SELECTED_WARNING_SOURCE,
      SELECTED_WARNING_PROVIDER_ID,
    );
    if (!warning) {
      throw new Error('selected historical replay warning was not persisted');
    }
    if (warning.ingestionMode !== 'REPLAY') {
      throw new Error(
        'selected historical replay warning is unavailable because newer LIVE state is persisted',
      );
    }

    return { vehicle, vehicles, warning };
  }

  private async prepareVehicle(
    context: PreparedDemoContext,
  ): Promise<DemoVehicleState> {
    const expected = expectedVehicleState(context, this.route);
    const existing = await this.vehicles.findByVehicleId(context.vehicleId);
    const vehicle = existing ?? (await this.vehicles.create(expected));

    if (!matchesApprovedVehicle(vehicle, expected)) {
      throw new Error('demo vehicle state conflicts with the approved setup');
    }

    const assignedVehicle = await this.vehicles.findByShipmentId(
      context.shipmentId,
    );
    if (!assignedVehicle) {
      await this.vehicles.assignShipment({
        shipmentId: context.shipmentId,
        vehicleId: context.vehicleId,
      });
    } else if (assignedVehicle.vehicleId !== context.vehicleId) {
      throw new Error(
        `${context.shipmentId} is already assigned to a different demo vehicle`,
      );
    }

    return vehicle;
  }
}
