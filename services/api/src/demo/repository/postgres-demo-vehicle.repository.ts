import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  DemoDriver,
  DemoPosition,
  DemoVehicleShipment,
  DemoVehicleState,
  NewDemoVehicleState,
} from '../model/demo-vehicle-state.model';

interface DemoVehicleStateRow {
  vehicleId: string;
  driver: DemoDriver;
  routeHash: string;
  elapsedSeconds: number;
  position: DemoPosition;
  simulatedAt: Date;
  revision: number;
  updatedAt: Date;
}

function mapDemoVehicleState(row: DemoVehicleStateRow): DemoVehicleState {
  return {
    vehicleId: row.vehicleId,
    driver: row.driver,
    routeHash: row.routeHash,
    elapsedSeconds: row.elapsedSeconds,
    position: row.position,
    simulatedAt: row.simulatedAt,
    revision: row.revision,
    updatedAt: row.updatedAt,
  };
}

const selectDemoVehicleState = `SELECT
  demo_vehicle_state.vehicle_id AS "vehicleId",
  driver,
  route_hash AS "routeHash",
  elapsed_seconds AS "elapsedSeconds",
  position,
  simulated_at AS "simulatedAt",
  revision,
  updated_at AS "updatedAt"
FROM demo_vehicle_state`;

@Injectable()
export class PostgresDemoVehicleRepository {
  constructor(private readonly database: DatabaseService) {}

  async create(state: NewDemoVehicleState): Promise<DemoVehicleState> {
    const result = await this.database.query<DemoVehicleStateRow>(
      `INSERT INTO demo_vehicle_state (
        vehicle_id,
        driver,
        route_hash,
        elapsed_seconds,
        position,
        simulated_at,
        revision
      ) VALUES ($1, $2::jsonb, $3, $4, $5::jsonb, $6, $7)
      RETURNING
        vehicle_id AS "vehicleId",
        driver,
        route_hash AS "routeHash",
        elapsed_seconds AS "elapsedSeconds",
        position,
        simulated_at AS "simulatedAt",
        revision,
        updated_at AS "updatedAt"`,
      [
        state.vehicleId,
        JSON.stringify(state.driver),
        state.routeHash,
        state.elapsedSeconds,
        JSON.stringify(state.position),
        state.simulatedAt,
        state.revision,
      ],
    );

    return mapDemoVehicleState(result.rows[0]);
  }

  async assignShipment(assignment: DemoVehicleShipment): Promise<void> {
    await this.database.query(
      `INSERT INTO demo_vehicle_shipments (shipment_id, vehicle_id)
      VALUES ($1, $2)`,
      [assignment.shipmentId, assignment.vehicleId],
    );
  }

  async findByVehicleId(
    vehicleId: string,
  ): Promise<DemoVehicleState | undefined> {
    const result = await this.database.query<DemoVehicleStateRow>(
      `${selectDemoVehicleState} WHERE vehicle_id = $1`,
      [vehicleId],
    );

    return result.rows[0] ? mapDemoVehicleState(result.rows[0]) : undefined;
  }

  async findByShipmentId(
    shipmentId: string,
  ): Promise<DemoVehicleState | undefined> {
    const result = await this.database.query<DemoVehicleStateRow>(
      `${selectDemoVehicleState}
      JOIN demo_vehicle_shipments ON demo_vehicle_shipments.vehicle_id = demo_vehicle_state.vehicle_id
      WHERE demo_vehicle_shipments.shipment_id = $1`,
      [shipmentId],
    );

    return result.rows[0] ? mapDemoVehicleState(result.rows[0]) : undefined;
  }

  async updatePositionIfRevision(
    vehicleId: string,
    expectedRevision: number,
    state: Pick<
      DemoVehicleState,
      'elapsedSeconds' | 'position' | 'simulatedAt'
    >,
  ): Promise<DemoVehicleState | undefined> {
    const result = await this.database.query<DemoVehicleStateRow>(
      `UPDATE demo_vehicle_state
      SET
        elapsed_seconds = $3,
        position = $4::jsonb,
        simulated_at = $5,
        revision = revision + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE vehicle_id = $1 AND revision = $2
      RETURNING
        vehicle_id AS "vehicleId",
        driver,
        route_hash AS "routeHash",
        elapsed_seconds AS "elapsedSeconds",
        position,
        simulated_at AS "simulatedAt",
        revision,
        updated_at AS "updatedAt"`,
      [
        vehicleId,
        expectedRevision,
        state.elapsedSeconds,
        JSON.stringify(state.position),
        state.simulatedAt,
      ],
    );

    return result.rows[0] ? mapDemoVehicleState(result.rows[0]) : undefined;
  }
}
