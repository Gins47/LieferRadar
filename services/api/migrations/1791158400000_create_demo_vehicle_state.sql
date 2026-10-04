-- Up Migration

CREATE TABLE demo_vehicle_state (
  vehicle_id TEXT PRIMARY KEY,
  driver JSONB NOT NULL,
  route_hash TEXT NOT NULL,
  elapsed_seconds INTEGER NOT NULL DEFAULT 0,
  position JSONB NOT NULL,
  simulated_at TIMESTAMPTZ NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT demo_vehicle_state_vehicle_id_not_blank CHECK (
    length(trim(vehicle_id)) > 0
  ),
  CONSTRAINT demo_vehicle_state_driver_shape CHECK (
    jsonb_typeof(driver) = 'object'
    AND jsonb_typeof(driver -> 'name') = 'string'
    AND length(trim(driver ->> 'name')) > 0
    AND jsonb_typeof(driver -> 'email') = 'string'
    AND length(trim(driver ->> 'email')) > 0
    AND jsonb_typeof(driver -> 'phone') = 'string'
    AND length(trim(driver ->> 'phone')) > 0
  ),
  CONSTRAINT demo_vehicle_state_route_hash_sha256 CHECK (
    route_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT demo_vehicle_state_elapsed_seconds_valid CHECK (
    elapsed_seconds BETWEEN 0 AND 7200
  ),
  CONSTRAINT demo_vehicle_state_position_shape CHECK (
    jsonb_typeof(position) = 'array'
    AND jsonb_array_length(position) = 2
    AND jsonb_typeof(position -> 0) = 'number'
    AND jsonb_typeof(position -> 1) = 'number'
    AND (position ->> 0)::DOUBLE PRECISION BETWEEN -180 AND 180
    AND (position ->> 1)::DOUBLE PRECISION BETWEEN -90 AND 90
  ),
  CONSTRAINT demo_vehicle_state_revision_valid CHECK (revision >= 0)
);

CREATE TABLE demo_vehicle_shipments (
  shipment_id TEXT PRIMARY KEY REFERENCES shipments(id),
  vehicle_id TEXT NOT NULL REFERENCES demo_vehicle_state(vehicle_id)
);

CREATE INDEX idx_demo_vehicle_shipments_vehicle_id
ON demo_vehicle_shipments(vehicle_id);

-- Down Migration

DROP TABLE demo_vehicle_shipments;
DROP TABLE demo_vehicle_state;
