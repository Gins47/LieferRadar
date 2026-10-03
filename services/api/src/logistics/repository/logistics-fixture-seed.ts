import type { ClientBase } from 'pg';
import {
  logisticsFixtureProducts,
  logisticsFixtureShipments,
  logisticsFixtureSuppliers,
} from './logistics-fixtures';

function assertFixtureMatch(matches: boolean, fixture: string): void {
  if (!matches) {
    throw new Error(`logistics fixture conflict for ${fixture}`);
  }
}

export async function seedLogisticsFixtures(client: ClientBase): Promise<void> {
  await client.query('BEGIN');

  try {
    for (const supplier of logisticsFixtureSuppliers) {
      await client.query(
        `INSERT INTO suppliers (id, name, location)
         VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (id) DO NOTHING`,
        [supplier.id, supplier.name, JSON.stringify(supplier.location)],
      );
    }

    for (const product of logisticsFixtureProducts) {
      await client.query(
        `INSERT INTO products (id, sku, name)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [product.id, product.sku, product.name],
      );
    }

    for (const shipment of logisticsFixtureShipments) {
      await client.query(
        `INSERT INTO shipments (
          id, supplier_id, product_id, quantity, pickup_location, destination,
          planned_route, status, pickup_at, planned_delivery_at
        ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::text[], $8, $9, $10)
        ON CONFLICT (id) DO NOTHING`,
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
    }

    for (const supplier of logisticsFixtureSuppliers) {
      const result = await client.query<{ matches: boolean }>(
        `SELECT EXISTS (
          SELECT 1
          FROM suppliers
          WHERE id = $1 AND name = $2 AND location = $3::jsonb
        ) AS matches`,
        [supplier.id, supplier.name, JSON.stringify(supplier.location)],
      );
      assertFixtureMatch(
        result.rows[0]?.matches === true,
        `supplier ${supplier.id}`,
      );
    }

    for (const product of logisticsFixtureProducts) {
      const result = await client.query<{ matches: boolean }>(
        `SELECT EXISTS (
          SELECT 1
          FROM products
          WHERE id = $1 AND sku = $2 AND name = $3
        ) AS matches`,
        [product.id, product.sku, product.name],
      );
      assertFixtureMatch(
        result.rows[0]?.matches === true,
        `product ${product.id}`,
      );
    }

    for (const shipment of logisticsFixtureShipments) {
      const result = await client.query<{ matches: boolean }>(
        `SELECT EXISTS (
          SELECT 1
          FROM shipments
          WHERE id = $1
            AND supplier_id = $2
            AND product_id = $3
            AND quantity = $4
            AND pickup_location = $5::jsonb
            AND destination = $6::jsonb
            AND planned_route = $7::text[]
            AND status = $8
            AND pickup_at = $9
            AND planned_delivery_at = $10
        ) AS matches`,
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
      assertFixtureMatch(
        result.rows[0]?.matches === true,
        `shipment ${shipment.id}`,
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
