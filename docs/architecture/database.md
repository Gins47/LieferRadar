# Database architecture decision

**Status:** Accepted for CP1 and Iteration 002, Phase 002A  
**Date:** 2026-10-03  
**Scope and progress:** [Iteration 002](../iterations/002-autobahn-integration.md)

## Persistence

- Use PostgreSQL with `pg` and `node-pg-migrate`; do not introduce TypeORM.
- Keep application SQL in repositories and schema changes in versioned migrations under `services/api/migrations/`, rather than `infra/postgresql/init.sql`.
- Use an injectable PostgreSQL logistics repository with typed persistence rows. The approved CP3 adjustment adds a minimal `LogisticsRepository` interface with three asynchronous ID lookups and a `LOGISTICS_REPOSITORY` Nest injection token. Keep database rows separate from domain interfaces; no generic repository layer is required.
- Retain one shared logistics repository under `src/logistics/repository/` and shared domain models under `src/logistics/model/`. Supplier, Product and Shipment remain separate feature modules; Location remains a shared value stored as JSONB.
- Preserve string logistics IDs, supplier/product references, `plannedRoute`, and `pickupAt`/`plannedDeliveryAt`. Store journey timestamps as `TIMESTAMPTZ` and motorway identifiers as `TEXT[]`; motorway intent is not route geometry.
- Store shipment quantity as `INTEGER`; quantities are positive whole-number units.
- Preserve the complete `SHP-001` response and deterministic Stuttgart–Munich/A8 fixture when persistence is introduced. Unknown shipments remain 404; broken internal relationships remain internal errors.

## Disruption storage and retrieval

- A1 is the initial disruption demonstration motorway. Store road identifiers as text and support other motorways without changing the schema or restricting all reads to A1.
- A disruption is identified by the pair `(source, provider_id)`. `queried_road` records the motorway used to retrieve the record; it does not prove that an event affects every direction or journey on that road.
- Follow the disruption schema and four retrieval indexes in Iteration 002. Include nullable `abnormal_traffic_type` (`TEXT`), `delay_minutes` (`INTEGER`) and `average_speed_kmh` (`INTEGER`). Provider traffic types remain unrestricted text.
- Preserve the complete provider payload in `raw_data`, including unknown fields and original value types. JSONB preserves JSON content, not original byte formatting. Missing optional application fields remain null; preserve German descriptions and GeoJSON `[longitude, latitude]` ordering.
- Store a canonical SHA-256 content hash derived from fields relevant to later interpretation. The hash describes a provider-record version; it must not prevent later analysis when a different shipment becomes relevant.
- The hash excludes `(source, provider_id)`, `raw_data`, ingestion and lifecycle fields because they identify or record collection rather than describe the interpreted warning. It includes `queried_road`: a retrieval-context update is relevant to later filtering, though it still does not prove journey impact.
- Store provider start and end timestamp values with presence flags. This distinguishes a field omitted by the provider from a field explicitly supplied as `null`, and permits later provider timestamp corrections.
- Hash timestamp values as UTC ISO strings with their presence state. Historical replay capture and observation timestamps are collection metadata and are excluded from the hash; provider-reported timestamps remain part of warning content.
- Store active-state lifecycle and observation fields: first capture, most recent observation, most recent live observation, and most recent content change. A stale observation or replay must not overwrite newer live state.
- The proposed resolution rule is provisional: mark a warning resolved only after it is absent from two consecutive complete, successful collections for its queried source and road. Failed or incomplete collections cannot resolve a warning. CP4 records the foundation only; it does not execute this policy.
- Prepare explicit fixture records using the authentic [A1 warnings](../../services/api/test/fixtures/autobahn/a1-warnings-2026-10.03.json): accident, queuing traffic and slow traffic. Do not infer missing structured traffic types or numeric facts from descriptions. Provider mapping and live collection belong to Phase 002B.
- The PostgreSQL disruption repository deduplicates observations atomically by `(source, provider_id)`, preserves internal identity and first capture, updates accepted observations safely, and promotes REPLAY to LIVE without demoting a newer live observation. Collection and replay orchestration remain outside CP4.
- An accepted observation must be strictly newer than the stored `lastSeenAt`. A replay is never accepted after a live observation. When the same identity is retrieved through a different motorway query, its `queried_road` updates only with an accepted newer observation; equal-time observations retain the persisted retrieval context.
- Repository insertion derives `lastLiveSeenAt` for LIVE observations and `contentChangedAt` from `lastSeenAt`. Observation updates lock the existing row and hash the effective content after timestamp merging; conflicting inserts retry the identity lookup inside the same READ COMMITTED transaction.
- Provider IDs are assumed stable and unique within a configured source across categories. The single queried-road field does not retain all roads through which a warning was observed. `lastSeenAt` must be a trusted observation instant; later replay orchestration must preserve historical observation evidence rather than use replay execution time to imply freshness.
- Lifecycle resolution is explicit: repository upserts never infer resolution from an absent warning. The provisional two-consecutive-complete-collection policy remains collection work outside CP4.
- Expose PostgreSQL reads through `GET /disruptions` and `GET /disruptions/:id`. Interpret calendar-date filters in `Europe/Berlin` and convert their boundaries inside PostgreSQL to UTC instants for inclusive start/exclusive end comparisons. Include the `to` calendar date through midnight of its following day; allow one-sided ranges.
- Retain the approved list envelope `{ items, page, limit, total }`, default page 1/limit 20, maximum limit 100, and ordering `captured_at DESC, id ASC`. The default date field is `startTimestamp`. Date filters select timestamps, not proven event duration or shipment impact.

### CP5 timezone clarification — approved 2026-10-03

Recorded as D11 in the [MVP decision register](../product/mvp-scope.md#7-decision-register).

- UTC is the standard for stored timestamp instants and internal service communication. Existing `TIMESTAMPTZ` columns remain unchanged; their session-dependent display does not change the stored instant.
- `Europe/Berlin` interprets calendar-date filters for the German MVP. Convert parameterized local calendar boundaries inside repository SQL using an explicit `AT TIME ZONE 'Europe/Berlin'`, independent of the session timezone.
- Calculate each local midnight independently, including midnight after the inclusive `to` date, before conversion. Do not add a fixed 24 hours to a converted UTC boundary; DST days may contain 23 or 25 hours.
- Compare the resulting UTC instants directly against the existing indexed `TIMESTAMPTZ` column. Apply conversion to filter boundaries, not to stored column values.
- Use existing PostgreSQL timezone support without adding a timezone dependency. This clarifies the conversion location; it does not change CP4 persistence semantics or authorize CP5 implementation.

## Isolated database verification

Development PostgreSQL remains managed by the root `docker-compose.yaml`. Tests use `services/api/docker-compose.test.yaml` with the same image, currently `pgvector/pgvector:0.8.6-pg18`.

The integration runner creates a unique Compose project, database, credentials and dynamic loopback port per run. It waits for PostgreSQL health, runs migrations, and executes database and HTTP tests using that connection. Storage uses `tmpfs`; teardown removes only the generated project's containers, networks and volumes, including after failure.

Test connections must use the runner-owned context and must never fall back to development connection settings. Keep fixture cleanup within the isolated database. Ordinary unit tests do not require Docker.

From the repository root:

```bash
npm --prefix services/api run test:integration
npm --prefix services/api run test:integration:cleanup
```

The first command runs normal integration and HTTP tests. The second verifies cleanup after a controlled subprocess failure, separately from the successful database connectivity test. Handled SIGINT/SIGTERM also trigger teardown; SIGKILL or an unavailable Docker daemon can prevent cleanup.

## Implementation boundary

CP1 supplies connection configuration, an injectable pool, migration tooling and isolated test orchestration. CP2.1 adds the versioned logistics schema migration. CP3 registers `DatabaseModule` through `LogisticsModule`, binds the repository token to PostgreSQL and makes shipment services asynchronous. The in-memory repository remains on disk but is no longer registered in the application.

CP2.2 provides explicit logistics fixture seeding through a development-only command. It inserts both fixture groups in one transaction, verifies values after conflict-safe inserts and rolls back conflicting runs. Migrations and seeding are never executed at startup. Local development loads `.env`; production uses external configuration. Test mode requires the isolated runner context. Startup verifies connectivity with a five-second connection timeout, and Nest shutdown hooks close the pool.

Accelerated Iteration A adds warning-only Autobahn collection without changing
persistence semantics: the integration validates and normalizes provider
records before using the existing repository upsert. `GET /disruptions` and
`GET /disruptions/:id` read only from PostgreSQL. The local-demo collection
route is disabled unless explicitly enabled and is always unavailable in
production. The warning fixture replay and demo-preparation commands use the
configured local development database only, with explicit invocation and
local/production guards. Historical `REPLAY` records and current `LIVE` records
may coexist; demo preparation verifies the exact recorded warning rather than
substituting LIVE state.
Collection does not schedule background work or infer resolution; closure
support remains deferred. Python migrations remain independent, and this
decision adds no PostGIS, tracking, AI or frontend work.
