-- Up Migration

CREATE TABLE disruptions (
  id UUID PRIMARY KEY,
  source TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  category TEXT NOT NULL,
  disruption_type TEXT NOT NULL,
  queried_road TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  description JSONB NOT NULL,
  start_timestamp TIMESTAMPTZ,
  start_timestamp_present BOOLEAN NOT NULL DEFAULT FALSE,
  end_timestamp TIMESTAMPTZ,
  end_timestamp_present BOOLEAN NOT NULL DEFAULT FALSE,
  future BOOLEAN,
  abnormal_traffic_type TEXT,
  delay_minutes INTEGER,
  average_speed_kmh INTEGER,
  coordinate JSONB,
  geometry JSONB,
  raw_data JSONB NOT NULL,
  content_hash TEXT NOT NULL,
  lifecycle_status TEXT NOT NULL DEFAULT 'ACTIVE',
  resolved_at TIMESTAMPTZ,
  ingestion_mode TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  last_live_seen_at TIMESTAMPTZ,
  content_changed_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT disruptions_source_not_blank CHECK (length(trim(source)) > 0),
  CONSTRAINT disruptions_provider_id_not_blank CHECK (
    length(trim(provider_id)) > 0
  ),
  CONSTRAINT disruptions_category_not_blank CHECK (length(trim(category)) > 0),
  CONSTRAINT disruptions_type_not_blank CHECK (
    length(trim(disruption_type)) > 0
  ),
  CONSTRAINT disruptions_queried_road_not_blank CHECK (
    length(trim(queried_road)) > 0
  ),
  CONSTRAINT disruptions_description_array CHECK (
    jsonb_typeof(description) = 'array'
  ),
  CONSTRAINT disruptions_start_timestamp_presence CHECK (
    start_timestamp IS NULL OR start_timestamp_present
  ),
  CONSTRAINT disruptions_end_timestamp_presence CHECK (
    end_timestamp IS NULL OR end_timestamp_present
  ),
  CONSTRAINT disruptions_content_hash_sha256 CHECK (
    content_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT disruptions_lifecycle_status_valid CHECK (
    lifecycle_status IN ('ACTIVE', 'RESOLVED')
  ),
  CONSTRAINT disruptions_resolved_at_consistent CHECK (
    (lifecycle_status = 'ACTIVE' AND resolved_at IS NULL)
    OR (lifecycle_status = 'RESOLVED' AND resolved_at IS NOT NULL)
  ),
  CONSTRAINT disruptions_ingestion_mode_valid CHECK (
    ingestion_mode IN ('LIVE', 'REPLAY')
  ),
  CONSTRAINT disruptions_observation_times_valid CHECK (
    captured_at <= content_changed_at
    AND content_changed_at <= last_seen_at
  )
);

CREATE UNIQUE INDEX idx_disruptions_source_provider_id
ON disruptions(source, provider_id);

CREATE INDEX idx_disruptions_start_timestamp
ON disruptions(start_timestamp);

CREATE INDEX idx_disruptions_captured_at
ON disruptions(captured_at);

CREATE INDEX idx_disruptions_queried_road_lifecycle_category_start
ON disruptions(queried_road, lifecycle_status, category, start_timestamp);

-- Down Migration

DROP TABLE disruptions;
