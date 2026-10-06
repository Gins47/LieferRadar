import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { Disruption } from '../disruption/model/disruption.model';
import { PostgresDisruptionRepository } from '../disruption/repository/postgres-disruption.repository';
import { AutobahnCollectionService } from '../integrations/autobahn/autobahn-collection.service';
import {
  DemoVehicleState,
  NewDemoVehicleState,
} from './model/demo-vehicle-state.model';
import { PostgresDemoVehicleRepository } from './repository/postgres-demo-vehicle.repository';
import { LuebeckHamburgRouteService } from './route/luebeck-hamburg-route.service';

export const DEMO_VEHICLE_ID = 'VEH-DEMO-002';
export const DEMO_SHIPMENT_ID = 'SHP-002';
export const SELECTED_WARNING_SOURCE = 'autobahn';
export const SELECTED_WARNING_PROVIDER_ID =
  'INRIX--vi-avl.2026-10-03_06-53-00-000_003.de0';
export const DEMO_START_AT = new Date('2026-10-03T06:30:00.000Z');
export const REPLAY_OBSERVED_AT = new Date('2026-10-03T07:00:00.000Z');

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
  route: LuebeckHamburgRouteService,
): NewDemoVehicleState {
  return {
    vehicleId: DEMO_VEHICLE_ID,
    driver: {
      name: 'Alex Demo',
      email: 'driver-shp002@example.invalid',
      phone: '+49 000 0000002',
    },
    routeHash: route.getRoute().routeHash,
    elapsedSeconds: 0,
    position: [10.686606, 53.865509],
    simulatedAt: DEMO_START_AT,
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
    const vehicle = await this.prepareVehicle();

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

    return { vehicle, warning };
  }

  private async prepareVehicle(): Promise<DemoVehicleState> {
    const expected = expectedVehicleState(this.route);
    const existing = await this.vehicles.findByVehicleId(DEMO_VEHICLE_ID);
    const vehicle = existing ?? (await this.vehicles.create(expected));

    if (!matchesApprovedVehicle(vehicle, expected)) {
      throw new Error('demo vehicle state conflicts with the approved setup');
    }

    const assignedVehicle =
      await this.vehicles.findByShipmentId(DEMO_SHIPMENT_ID);
    if (!assignedVehicle) {
      await this.vehicles.assignShipment({
        shipmentId: DEMO_SHIPMENT_ID,
        vehicleId: DEMO_VEHICLE_ID,
      });
    } else if (assignedVehicle.vehicleId !== DEMO_VEHICLE_ID) {
      throw new Error(
        'SHP-002 is already assigned to a different demo vehicle',
      );
    }

    return vehicle;
  }
}
