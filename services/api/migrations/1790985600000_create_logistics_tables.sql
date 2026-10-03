-- Up Migration

CREATE TABLE suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location JSONB NOT NULL,
  CONSTRAINT suppliers_location_shape CHECK (
    jsonb_typeof(location) = 'object'
    AND location ? 'city'
    AND jsonb_typeof(location -> 'city') = 'string'
    AND location ? 'countryCode'
    AND jsonb_typeof(location -> 'countryCode') = 'string'
    AND (
      NOT location ? 'latitude'
      OR jsonb_typeof(location -> 'latitude') = 'number'
    )
    AND (
      NOT location ? 'longitude'
      OR jsonb_typeof(location -> 'longitude') = 'number'
    )
  )
);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE shipments (
  id TEXT PRIMARY KEY,
  supplier_id TEXT NOT NULL REFERENCES suppliers (id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  product_id TEXT NOT NULL REFERENCES products (id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  pickup_location JSONB NOT NULL,
  destination JSONB NOT NULL,
  planned_route TEXT[] NOT NULL,
  status TEXT NOT NULL,
  pickup_at TIMESTAMPTZ NOT NULL,
  planned_delivery_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT shipments_quantity_positive CHECK (quantity > 0),
  CONSTRAINT shipments_pickup_location_shape CHECK (
    jsonb_typeof(pickup_location) = 'object'
    AND pickup_location ? 'city'
    AND jsonb_typeof(pickup_location -> 'city') = 'string'
    AND pickup_location ? 'countryCode'
    AND jsonb_typeof(pickup_location -> 'countryCode') = 'string'
    AND (
      NOT pickup_location ? 'latitude'
      OR jsonb_typeof(pickup_location -> 'latitude') = 'number'
    )
    AND (
      NOT pickup_location ? 'longitude'
      OR jsonb_typeof(pickup_location -> 'longitude') = 'number'
    )
  ),
  CONSTRAINT shipments_destination_shape CHECK (
    jsonb_typeof(destination) = 'object'
    AND destination ? 'city'
    AND jsonb_typeof(destination -> 'city') = 'string'
    AND destination ? 'countryCode'
    AND jsonb_typeof(destination -> 'countryCode') = 'string'
    AND (
      NOT destination ? 'latitude'
      OR jsonb_typeof(destination -> 'latitude') = 'number'
    )
    AND (
      NOT destination ? 'longitude'
      OR jsonb_typeof(destination -> 'longitude') = 'number'
    )
  ),
  CONSTRAINT shipments_planned_route_nonempty CHECK (
    cardinality(planned_route) > 0
  ),
  CONSTRAINT shipments_status_valid CHECK (
    status IN ('PLANNED', 'IN_TRANSIT', 'DELIVERED', 'DELAYED', 'CANCELLED')
  ),
  CONSTRAINT shipments_delivery_after_pickup CHECK (
    planned_delivery_at > pickup_at
  )
);

-- Down Migration

DROP TABLE shipments;
DROP TABLE products;
DROP TABLE suppliers;
