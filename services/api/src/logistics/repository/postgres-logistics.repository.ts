import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { Location } from '../model/location.model';
import { Product } from '../model/product.model';
import { Shipment, ShipmentStatus } from '../model/shipment.model';
import { Supplier } from '../model/supplier.model';
import { LogisticsRepository } from './logistics-repository';

interface SupplierRow {
  id: string;
  name: string;
  location: Location;
}

interface ProductRow {
  id: string;
  sku: string;
  name: string;
}

interface ShipmentRow {
  id: string;
  supplierId: string;
  productId: string;
  quantity: number;
  pickupLocation: Location;
  destination: Location;
  plannedRoute: string[];
  status: ShipmentStatus;
  pickupAt: Date;
  plannedDeliveryAt: Date;
}

function mapSupplier(row: SupplierRow): Supplier {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
  };
}

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
  };
}

function mapShipment(row: ShipmentRow): Shipment {
  return {
    id: row.id,
    supplierId: row.supplierId,
    productId: row.productId,
    quantity: row.quantity,
    pickupLocation: row.pickupLocation,
    destination: row.destination,
    plannedRoute: row.plannedRoute,
    status: row.status,
    pickupAt: row.pickupAt,
    plannedDeliveryAt: row.plannedDeliveryAt,
  };
}

@Injectable()
export class PostgresLogisticsRepository implements LogisticsRepository {
  constructor(private readonly database: DatabaseService) {}

  async createShipment(shipment: Shipment): Promise<Shipment> {
    const result = await this.database.query<ShipmentRow>(
      `INSERT INTO shipments (
        id, supplier_id, product_id, quantity, pickup_location, destination,
        planned_route, status, pickup_at, planned_delivery_at
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::text[], $8, $9, $10)
      RETURNING
        id,
        supplier_id AS "supplierId",
        product_id AS "productId",
        quantity,
        pickup_location AS "pickupLocation",
        destination,
        planned_route AS "plannedRoute",
        status,
        pickup_at AS "pickupAt",
        planned_delivery_at AS "plannedDeliveryAt"`,
      [
        shipment.id,
        shipment.supplierId,
        shipment.productId,
        shipment.quantity,
        JSON.stringify(shipment.pickupLocation),
        JSON.stringify(shipment.destination),
        shipment.plannedRoute,
        shipment.status,
        shipment.pickupAt,
        shipment.plannedDeliveryAt,
      ],
    );

    return mapShipment(result.rows[0]);
  }

  async findAllShipments(): Promise<Shipment[]> {
    const result = await this.database.query<ShipmentRow>(
      `SELECT
        id,
        supplier_id AS "supplierId",
        product_id AS "productId",
        quantity,
        pickup_location AS "pickupLocation",
        destination,
        planned_route AS "plannedRoute",
        status,
        pickup_at AS "pickupAt",
        planned_delivery_at AS "plannedDeliveryAt"
      FROM shipments
      ORDER BY id ASC`,
    );

    return result.rows.map(mapShipment);
  }

  async findSupplierById(id: string): Promise<Supplier | undefined> {
    const result = await this.database.query<SupplierRow>(
      'SELECT id, name, location FROM suppliers WHERE id = $1',
      [id],
    );

    return result.rows[0] ? mapSupplier(result.rows[0]) : undefined;
  }

  async findProductById(id: string): Promise<Product | undefined> {
    const result = await this.database.query<ProductRow>(
      'SELECT id, sku, name FROM products WHERE id = $1',
      [id],
    );

    return result.rows[0] ? mapProduct(result.rows[0]) : undefined;
  }

  async findShipmentById(id: string): Promise<Shipment | undefined> {
    const result = await this.database.query<ShipmentRow>(
      `SELECT
        id,
        supplier_id AS "supplierId",
        product_id AS "productId",
        quantity,
        pickup_location AS "pickupLocation",
        destination,
        planned_route AS "plannedRoute",
        status,
        pickup_at AS "pickupAt",
        planned_delivery_at AS "plannedDeliveryAt"
      FROM shipments
      WHERE id = $1`,
      [id],
    );

    return result.rows[0] ? mapShipment(result.rows[0]) : undefined;
  }
}
