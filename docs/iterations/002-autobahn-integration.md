# Iteration 002 — Autobahn Integration & Persistence

**Project:** LieferRadar  
**Status:** Phase 002A in progress — CP1 and CP2 completed; CP3 next<br>
**Dependency:** Iteration 001 — Completed  
**Database:** PostgreSQL 18 with pgvector, running through Docker Compose

## Objective

Build the persistence and external data integration foundation for LieferRadar.

By the end of this iteration, the application must collect real Autobahn warnings and closures, preserve their original geographic and textual information, and provide efficient retrieval through REST APIs.

Implementation is divided into two independently testable phases.

| Phase | Focus                  | Deliverable                                                           |
| ----- | ---------------------- | --------------------------------------------------------------------- |
| 002A  | PostgreSQL persistence | Database migrations, repositories and indexed retrieval endpoints     |
| 002B  | Autobahn integration   | External API clients, normalization, collection and historical replay |

Driver tracking, direction-aware matching, AI assessments and frontend visualization belong to subsequent iterations.

Approved database decisions are recorded in [Database architecture](../architecture/database.md). This document defines the current Iteration 002 scope; earlier iteration forecasts and research phase labels are historical context.

---

# Phase 002A — PostgreSQL Persistence & Retrieval

**Status:** CP1 and CP2 completed; CP3 next, awaiting implementation authorization

**Goal:** Implement reliable database persistence and disruption retrieval independently of the external Autobahn API.

## Checkpoint progress

| Checkpoint | Scope | Status | Acceptance gate |
| ---------- | ----- | ------ | --------------- |
| CP1 | Connection configuration, migration tooling and isolated PostgreSQL testing | Completed | Nest database-module connectivity, migration runner, existing HTTP tests and separate failure-cleanup verification |
| CP2 | Supplier, Product and Shipment tables with explicit fixture seeding | Completed | Logistics migrations, idempotent fixture round-trip and CP2.3 verification in isolated PostgreSQL |
| CP3 | PostgreSQL logistics repository and asynchronous shipment lookups | Not started | Unchanged shipment HTTP response, 404 and internal relationship-error behavior |
| CP4 | Disruption table, indexes, inserts, upserts and identity lookups | Not started | Deduplication, timestamps, provenance, nullable fields and raw-payload preservation |
| CP5 | A1 fixture-backed queries, Berlin date filtering and pagination | Not started | Authentic fixture retrieval, combined filters, timezone boundaries and stable ordering |
| CP6 | Disruption retrieval module, DTOs, service and controller | Not started | List/detail HTTP contracts, query validation and shipment regression |
| CP7 | Phase 002A acceptance and diff review | Not started | Complete checks and persistence after application restart; review before Phase 002B |

### CP1 completion record

- Added `pg`, `node-pg-migrate` and an injectable database module with pool cleanup. The module remains outside `AppModule`; existing logistics repositories remain in memory.
- Added `services/api/docker-compose.test.yaml` and a minimal runner using a unique Compose project, generated credentials, a dynamic loopback port, health waiting and temporary `tmpfs` storage. Development PostgreSQL is untouched by the workflow.
- The runner executes migrations and database/HTTP tests, then removes its own resources on success or failure. Cleanup verification is a separate command; the connectivity test has no intentional failure branch.
- Added the versioned migration directory and command. At CP1 execution, there were no application schema migrations and the command reported "No migrations to run".

### CP2.1 completion record

- Added versioned Supplier, Product and Shipment tables with foreign keys and the approved location, route, status, quantity and timing constraints.
- Added `migrate:down` and an isolated migration test that verifies table creation and safe rollback/reapplication.

### CP2.2 implementation record

- Added explicit, idempotent Supplier, Product and Shipment fixture seeding through a development-only command; the running application still uses in-memory logistics fixtures.
- Preserved `SHP-001` unchanged and added the separately documented synthetic A1 `SHP-002` scenario.
- Added isolated tests for exact fixture values, repeated seeding, and atomic rollback on both fixture-group conflicts.

### CP2.3 completion record

- Verified the migration's isolated up/down/up lifecycle, exact fixture seeding, repeated-seed idempotency and atomic rollback for conflicts in both fixture groups.
- Ran unit tests (6 suites, 10 tests), isolated database tests (3 suites, 7 tests) and HTTP regression tests (1 suite, 3 tests). All passed.
- TypeScript checking and the production build passed. The full non-mutating lint check still reports seven errors and one warning in Iteration 001 files: the Zod validation pipe, application bootstrap and shipment service spec. CP2 introduced no lint findings.
- Confirmed the `SHP-001` HTTP response is unchanged and `SHP-002` matches the documented synthetic Lübeck-to-Hamburg A1 scenario.

Previously executed CP1 checks: database connectivity (1 test), existing HTTP tests (3 tests), unit tests (10 tests), TypeScript checks, build, test Compose configuration and separate failure-cleanup verification passed. CP1 TypeScript files passed lint; the full project had existing lint findings in the validation pipe, bootstrap and shipment spec. These are historical results, not checks executed by a documentation update.

From the repository root:

```bash
npm --prefix services/api run test:integration
npm --prefix services/api run test:integration:cleanup
```

**Next checkpoint:** CP3 introduces PostgreSQL logistics repository lookups. It must preserve the shipment HTTP contract and does not add disruption storage or collection. Stop for review at each authorized checkpoint.

## A1. Database configuration

PostgreSQL is already running through the existing `docker-compose.yaml`.

Existing configuration:

- Container: `lieferrader-postgres`
- Database: `lieferrader_db`
- PostgreSQL user: `app`
- Image: `pgvector/pgvector:0.8.6-pg18`
- Port: `5432`

Tasks:

- [x] Verify the NestJS database module connects to isolated PostgreSQL.
- [x] Configure database connection settings using environment variables.
- [x] Use the approved `pg` driver and `node-pg-migrate` tooling; no TypeORM.
- [x] Introduce version-controlled migration tooling and its directory.
- [x] Configure an isolated, ephemeral PostgreSQL test container in its own Compose project, using the development image version.
- [ ] Verify development-backed application connectivity when registering persistence at CP3.

Application schema migrations begin at CP2. Tests must use the runner-owned database and must never create or modify a test database in the development container.

Do not recreate the PostgreSQL container or replace the existing Docker Compose configuration.

Do not use `init.sql` for application schema changes. Use migrations instead.

The pgvector extension is available but is not required for this iteration.

## A2. Migrate existing logistics persistence

Replace the existing in-memory repositories with PostgreSQL-backed implementations.

Preserve the existing:

- Supplier domain.
- Product domain.
- Shipment domain.
- Business rules.
- REST API contracts.
- Automated tests.

Retain the existing shipment fixture, including `SHP-001`.

Preserve the shipment's planned motorway information. If the existing domain uses `plannedRoute`, retain that field rather than introducing an equivalent field unnecessarily.

Motorway identifiers represent expected roads, not verified route geometry.

## A3. Disruption database model

Create a `disruptions` table.

| Column          | PostgreSQL type | Description                        |
| --------------- | --------------- | ---------------------------------- |
| id              | UUID            | Internal primary key               |
| provider_id     | TEXT            | External event identifier          |
| source          | TEXT            | Original provider                  |
| category        | TEXT            | WARNING or CLOSURE                 |
| road            | TEXT            | Motorway identifier                |
| title           | TEXT            | Original event title               |
| subtitle        | TEXT            | Original directional subtitle      |
| description     | JSONB           | Original German description        |
| start_timestamp | TIMESTAMPTZ     | Provider-reported event start      |
| future          | BOOLEAN         | Provider-reported future indicator |
| abnormal_traffic_type | TEXT      | Nullable provider traffic type     |
| delay_minutes   | INTEGER         | Nullable reported delay in minutes |
| average_speed_kmh | INTEGER       | Nullable reported speed in km/h    |
| coordinate      | JSONB           | Original event coordinate          |
| geometry        | JSONB           | Original GeoJSON geometry          |
| raw_data        | JSONB           | Complete original API payload      |
| ingestion_mode  | TEXT            | LIVE or REPLAY                     |
| captured_at     | TIMESTAMPTZ     | First ingestion timestamp          |
| last_seen_at    | TIMESTAMPTZ     | Most recent observation            |

Use nullable fields where the external API does not guarantee values.

Missing optional fields remain null, including the three traffic fields. Avoid restrictive provider-specific enums; preserve unfamiliar traffic types as text and unknown payload fields in `raw_data`.

Preserve original German text without translation or modification.

Store geographic geometry as JSONB.

GeoJSON uses `[longitude, latitude]` coordinate ordering. Do not reverse coordinates during persistence.

### Ingestion provenance

`ingestion_mode` distinguishes live collection from historical replay.

If a previously replayed event is subsequently observed through the live API, update its provenance appropriately without modifying its original provider timestamp.

Preserve the original payload for traceability.

## A4. Indexes and constraints

Create the following indexes through database migrations:

```sql
CREATE UNIQUE INDEX idx_disruptions_provider_category
ON disruptions(provider_id, category);

CREATE INDEX idx_disruptions_start_timestamp
ON disruptions(start_timestamp);

CREATE INDEX idx_disruptions_captured_at
ON disruptions(captured_at);

CREATE INDEX idx_disruptions_road_category_start
ON disruptions(road, category, start_timestamp);
```

The unique index prevents duplicate disruption records.

Timestamp indexes support date-based retrieval.

The composite index supports filtering by motorway, category and event start date.

Do not introduce PostGIS or additional spatial indexes in this iteration.

## A5. Disruption repository

Implement a PostgreSQL-backed disruption repository supporting:

- Insert.
- Upsert.
- Retrieve by internal UUID.
- Retrieve by provider identifier and category.
- Filter by motorway and category.
- Filter by date or date range.
- Paginated retrieval.

Upsert behavior:

- Insert new events.
- Update existing events without creating duplicates.
- Preserve `captured_at`.
- Update `last_seen_at` when the event is observed again.
- Preserve the original provider event timestamp.

Keep database operations separate from external HTTP integration.

## A6. REST API — Disruption retrieval

### Retrieve disruptions

`GET /disruptions`

Supported query parameters:

| Parameter | Description                  |
| --------- | ---------------------------- |
| road      | Motorway identifier          |
| category  | WARNING or CLOSURE           |
| date      | Specific calendar date       |
| from      | Start of date range          |
| to        | End of date range            |
| dateField | startTimestamp or capturedAt |
| page      | Page number                  |
| limit     | Page size                    |

Examples:

```http
GET /disruptions?date=2026-10-03

GET /disruptions?from=2026-10-01&to=2026-10-05

GET /disruptions?road=A1&category=WARNING&from=2026-10-01&to=2026-10-05

GET /disruptions?date=2026-10-03&dateField=capturedAt
```

### Date-filtering rules

- Default `dateField` to `startTimestamp`.
- Interpret date-only inputs using `Europe/Berlin`.
- Convert date boundaries to UTC before database queries.
- Use inclusive start and exclusive end timestamps.
- Reject invalid dates and reversed ranges.
- Do not combine `date` with `from` or `to`.
- Support pagination with stable ordering.

A date filter identifies events by their selected timestamp. It does not establish that they remained active throughout that date.

Historical queries can only retrieve events that have already been collected or imported.

### Retrieve an individual disruption

`GET /disruptions/:id`

Return the persisted event, including:

- Normalized fields.
- Original German description.
- Original coordinates and GeoJSON geometry.
- Provider information.
- Collection timestamps.
- Ingestion provenance.

Both retrieval endpoints must read exclusively from PostgreSQL.

## A7. Fixture-based development

Before implementing the Autobahn integration, prepare representative fixtures.

Include:

1. The authentic A1 accident, queuing-traffic and slow-traffic warnings with directional information and LineString geometry in [the supplied fixture](../../services/api/test/fixtures/autobahn/a1-warnings-2026-10.03.json).
2. A closure response.
3. An event containing missing optional fields.

Use authentic captured API payloads wherever available.

A1 is the initial disruption demonstration motorway; storage and retrieval remain configurable for other roads. Preserve the existing Iteration 001 A8 shipment fixture. Phase 002A uses explicit application-owned fixture records with unchanged raw provider payloads; general provider mapping remains Phase 002B.

Insert records through integration-test setup or a development-only seed command.

Do not introduce a public endpoint for inserting arbitrary disruptions.

## A8. Testing

### Repository integration tests

- Insert and retrieve disruptions.
- Upsert without duplication.
- Preserve timestamps correctly.
- Preserve GeoJSON coordinates.
- Filter by motorway and category.
- Filter by date and date range.
- Handle German timezone boundaries.
- Verify pagination and stable ordering.

### HTTP tests

- Retrieve disruption lists.
- Retrieve individual disruptions.
- Combine supported filters.
- Reject invalid query parameters.
- Verify existing shipment endpoints still work.

Run persistence integration and HTTP tests through the CP1 ephemeral-container workflow, never against development PostgreSQL. Isolate fixtures and clean test data between tests where necessary. Run the separate cleanup command when verifying runner teardown changes.

## Phase 002A — Completion checklist

- [ ] NestJS connects to the existing PostgreSQL container.
- [ ] Database migrations execute successfully.
- [ ] Existing logistics repositories use PostgreSQL.
- [ ] Existing shipment functionality remains operational.
- [ ] Disruption table and indexes exist.
- [ ] Disruption repository is implemented.
- [ ] Date and date-range filtering work.
- [ ] Pagination works.
- [ ] GeoJSON is preserved.
- [ ] Unit and integration tests pass.

**Phase deliverable:** Tested PostgreSQL persistence and disruption retrieval APIs.

**Checkpoint:** Review migrations, indexes, repository structure, endpoint responses and test results before proceeding.

---

# Phase 002B — Autobahn API Integration

**Status:** Starts after Phase 002A

**Goal:** Collect real Autobahn disruptions and populate the database through a reliable external integration.

## B1. Autobahn API client

Base URL:

`https://verkehr.autobahn.de/o/autobahn`

Implement four operations:

| Operation       | Endpoint                            |
| --------------- | ----------------------------------- |
| List warnings   | `GET /{road}/services/warning`      |
| Warning details | `GET /details/warning/{identifier}` |
| List closures   | `GET /{road}/services/closure`      |
| Closure details | `GET /details/closure/{identifier}` |

Initially monitor A1 and A8.

Client requirements:

- Configurable base URL.
- Request timeout.
- Limited retries for transient failures.
- URL-encoded identifiers.
- Response validation.
- Clear error handling.

The client must not contain persistence logic.

## B2. Validation and normalization

Use the existing Zod validation conventions.

Create independently testable mapping functions.

Normalize warning and closure responses into a common disruption model.

Preserve:

- Provider identifier.
- Event category.
- Motorway identifier.
- Original title and subtitle.
- Original German description.
- Event timestamps.
- Coordinates.
- GeoJSON geometry.
- Complete original payload.

Do not infer direction from GeoJSON coordinate order.

Do not classify every warning as a confirmed closure.

Structured AI extraction belongs to Iteration 004.

## B3. Collection service

Implement a service coordinating external collection and database persistence.

Workflow:

1. Load requested motorway identifiers.
2. Fetch warning and closure lists.
3. Validate API responses.
4. Normalize individual events.
5. Upsert normalized records.
6. Record collection results and failures.

Fetch individual event details selectively.

Do not require a detail request for every collected event unless testing demonstrates that the list response lacks essential information.

Partial failures must not prevent successfully retrieved records from being persisted.

## B4. Manual collection endpoint

Implement:

`POST /integrations/autobahn/collect`

Example request:

```json
{
  "roads": ["A1", "A8"],
  "categories": ["WARNING", "CLOSURE"]
}
```

Return a summary containing:

- Inserted records.
- Updated records.
- Failed requests.
- Collection mode.
- Collection timestamp.

Validate requested roads and categories.

Use configured defaults when optional parameters are omitted.

This is a development/demo operation and must not be exposed publicly without appropriate access controls.

## B5. Individual event details

Implement separate client methods for warning and closure details.

Use provider identifiers returned by the list endpoints.

Compare list and detail responses to identify any additional information.

When details provide additional fields, update the corresponding persisted disruption.

Avoid unnecessary external requests.

## B6. Historical fixtures and replay

Capture authentic API responses for repeatable testing and demonstrations.

For each fixture, preserve:

- Original endpoint.
- Provider identifier.
- Motorway.
- Capture timestamp.
- Complete original response.

Implement a development-only fixture-import command.

Replay must use the same validation, normalization and persistence pipeline as live collection.

Explicitly label imported records as historical replay.

Do not silently substitute historical data when live collection fails.

Do not modify historical event timestamps.

## B7. Testing

### Client unit tests

- Correct endpoint construction.
- Identifier encoding.
- Timeouts.
- Retries.
- Error handling.

### Mapper unit tests

- Warning normalization.
- Closure normalization.
- Preservation of German text.
- GeoJSON coordinate ordering.
- Optional-field handling.
- Invalid response handling.

### Collection integration tests

- Multiple motorway collection.
- Multiple event categories.
- Insert and update behavior.
- Duplicate prevention.
- Partial failures.
- Historical fixture replay.

Mock external HTTP calls during automated tests.

## Phase 002B — Completion checklist

- [ ] A1 and A8 warnings can be collected.
- [ ] A1 and A8 closures can be collected.
- [ ] Individual warning and closure details can be retrieved.
- [ ] Responses are validated and normalized.
- [ ] Original descriptions and geometry are preserved.
- [ ] Collection persists records in PostgreSQL.
- [ ] Repeated collection avoids duplicates.
- [ ] Partial failures are handled.
- [ ] Historical replay works.
- [ ] Automated tests pass.

**Phase deliverable:** A tested integration with the official Autobahn API.

---

# Final Iteration 002 Verification

Perform one complete end-to-end test:

1. Run all database migrations.
2. Confirm existing shipment functionality.
3. Trigger manual Autobahn collection.
4. Verify collected disruptions are persisted.
5. Repeat collection and verify deduplication.
6. Retrieve disruptions using motorway and category filters.
7. Retrieve disruptions by date and date range.
8. Retrieve an individual event with its original GeoJSON.
9. Restart the application and confirm records remain available.
10. Import an authentic historical fixture.
11. Run the complete automated test suite.

**Iteration 002 is complete when both phase checkpoints and the final verification pass.**

---

# Handoff to Iteration 003

The next iteration will introduce:

- Mocked fleet-tracking integration.
- Shipment location history.
- Driver position visualization.
- Deterministic motorway and direction matching.
- Verified junction ordering.
- Candidate shipment alerts.

Iteration 002 must not generate driver-impact conclusions or alternative route recommendations.
