# Database architecture decision

**Status:** Accepted for CP1 and Iteration 002, Phase 002A  
**Date:** 2026-10-03  
**Scope and progress:** [Iteration 002](../iterations/002-autobahn-integration.md)

## Persistence

- Use PostgreSQL with `pg` and `node-pg-migrate`; do not introduce TypeORM.
- Keep application SQL in repositories and schema changes in versioned migrations under `services/api/migrations/`, rather than `infra/postgresql/init.sql`.
- Use injectable concrete repository classes and typed persistence rows. Keep database representations separate from the existing domain interfaces; no generic repository layer or custom injection tokens are required.
- Retain one shared logistics repository under `src/logistics/repository/` and shared domain models under `src/logistics/model/`. Supplier, Product and Shipment remain separate feature modules; Location remains a shared value stored as JSONB.
- Preserve string logistics IDs, supplier/product references, `plannedRoute`, and `pickupAt`/`plannedDeliveryAt`. Store journey timestamps as `TIMESTAMPTZ` and motorway identifiers as `TEXT[]`; motorway intent is not route geometry.
- Store shipment quantity as `INTEGER`; quantities are positive whole-number units.
- Preserve the complete `SHP-001` response and deterministic Stuttgart–Munich/A8 fixture when persistence is introduced. Unknown shipments remain 404; broken internal relationships remain internal errors.

## Disruption storage and retrieval

- A1 is the initial disruption demonstration motorway. Store road identifiers as text and support other motorways without changing the schema or restricting all reads to A1.
- Follow the disruption schema and four indexes in Iteration 002. Include nullable `abnormal_traffic_type` (`TEXT`), `delay_minutes` (`INTEGER`) and `average_speed_kmh` (`INTEGER`). Provider traffic types remain unrestricted text.
- Preserve the complete provider payload in `raw_data`, including unknown fields and original value types. JSONB preserves JSON content, not original byte formatting. Missing optional application fields remain null; preserve German descriptions and GeoJSON `[longitude, latitude]` ordering.
- Prepare explicit fixture records using the authentic [A1 warnings](../../services/api/test/fixtures/autobhan/a1-warnings-2026-10.03.json): accident, queuing traffic and slow traffic. Do not infer missing structured traffic types or numeric facts from descriptions. Provider mapping and live collection belong to Phase 002B.
- Deduplicate atomically by provider ID and category. Preserve internal identity, first ingestion time and an existing provider start timestamp; update the latest observation time. Allow enrichment of an initially missing start. Promote REPLAY to LIVE when observed live without demoting it on subsequent replay.
- Expose PostgreSQL reads through `GET /disruptions` and `GET /disruptions/:id`. Interpret calendar-date filters in `Europe/Berlin`, convert to UTC, and query inclusive start/exclusive end boundaries. Include the `to` calendar date through midnight of its following day; allow one-sided ranges.
- Retain the approved list envelope `{ items, page, limit, total }`, default page 1/limit 20, maximum limit 100, and ordering `captured_at DESC, id ASC`. The default date field is `startTimestamp`. Date filters select timestamps, not proven event duration or shipment impact.

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

CP1 supplies connection configuration, an injectable pool, migration tooling and isolated test orchestration. `DatabaseModule` is not yet registered in `AppModule`; logistics still uses its in-memory repository. The migration directory currently has no application schema migrations. CP1 verifies connectivity in the isolated test module, not development-backed application persistence.

CP2 adds logistics tables and fixture seeding. Repository migration follows at CP3. Phase 002A remains storage and fixture-based retrieval; provider normalization, live collection and general replay are Phase 002B. Python migrations remain independent, and this decision adds no PostGIS, scheduler, tracking, AI or frontend work.
