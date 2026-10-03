# Iteration 002 — Autobahn Integration & Persistence

**Project:** LieferRadar  
**Status:** Phase 002A in progress — CP1–CP6 completed; accelerated Iteration A review pending<br>
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

**Status:** CP1–CP6 completed; accelerated Iteration A review pending

**Goal:** Implement reliable database persistence and disruption retrieval independently of the external Autobahn API.

## Checkpoint progress

| Checkpoint | Scope | Status | Acceptance gate |
| ---------- | ----- | ------ | --------------- |
| CP1 | Connection configuration, migration tooling and isolated PostgreSQL testing | Completed | Nest database-module connectivity, migration runner, existing HTTP tests and separate failure-cleanup verification |
| CP2 | Supplier, Product and Shipment tables with explicit fixture seeding | Completed | Logistics migrations, idempotent fixture round-trip and CP2.3 verification in isolated PostgreSQL |
| CP3 | PostgreSQL logistics repository and asynchronous shipment lookups | Completed | Unchanged shipment HTTP response, 404 and internal relationship-error behavior |
| CP4 | Disruption table, indexes, inserts, upserts and identity lookups | Completed | Disruption schema, canonical model/hash, persistence behavior and identity lookups |
| CP5 | A1 fixture-backed queries, Berlin date filtering and pagination | Completed | Authentic fixture retrieval, combined filters, timezone boundaries and stable ordering |
| CP6 | Disruption retrieval module, DTOs, service and controller | Completed | PostgreSQL list/detail HTTP contracts, query validation and shipment regression |
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

### CP3 completion record — CP3.4 verification, 2026-10-03

- The application resolves `LOGISTICS_REPOSITORY` to PostgreSQL. Shipment lookup is asynchronous; supplier/product resolution remains in `ShipmentService`. Unknown IDs return 404, broken relationships remain internal errors, and database failures propagate unchanged.
- Unit tests passed with database configuration removed (7 suites, 12 tests). Isolated database tests passed (4 suites, 11 tests), including repository mapping for both fixtures and parameterized lookups. Real `AppModule` HTTP tests passed (1 suite, 4 tests), preserving the full SHP-001 response and verifying SHP-002 and unknown-ID 404.
- TypeScript and production build passed. Full non-mutating lint reports one pre-existing unused `metadata` error in `zod-body-validation.pipe.ts:11`, traced to Iteration 001; no CP3 lint regressions were found.
- Compiled local startup loaded `.env`, connected to development PostgreSQL and terminated successfully via SIGTERM. A production probe with unavailable PostgreSQL exited before listening. These probes did not migrate or seed development data. Connectivity uses a five-second connection timeout; module destruction closes the pool.
- Test mode requires isolated runner configuration. Controlled failure-cleanup verification passed, removing its container and network. Migrations and seeding remain explicit, and HTTP tests seed their own isolated state once per suite.
- Final review identified and corrected a build-layout defect: `scripts/` is excluded from the Nest application build so the existing production command can find `dist/main.js`. Scripts still execute separately through their npm commands. Development and production instructions are updated in `services/api/README.md`.

### CP4.1 completion record — 2026-10-03

- Added the `disruptions` migration with `(source, provider_id)` identity, `queried_road`, original German information, GeoJSON and raw provider payload storage, nullable traffic fields, canonical content-hash storage, timestamp-presence flags, lifecycle fields and observation timestamps.
- Added the unique identity index plus indexes for provider start time, capture time and queried-road/lifecycle/category/start-time retrieval. The migration does not add hashing, a repository, collection, resolution execution, matching or AI integration.
- Added focused isolated migration tests for creation, rollback and reapplication. The rollback test confirms that existing Supplier, Product and Shipment tables remain intact. The existing logistics rollback test now steps past the newer disruption migration and restores both migrations in `finally`.
- Current checks passed: unit tests (7 suites, 12 tests), TypeScript check, focused migration-test lint, production build, isolated database tests (5 suites, 13 tests) and PostgreSQL-backed HTTP regression tests (1 suite, 4 tests). The integration runner removed its temporary container and network.
- Full non-mutating lint still has one pre-existing error: unused `metadata` in `services/api/src/common/pipes/zod-body-validation.pipe.ts:11`. No CP4.1 file has a lint finding.

### CP4.2 completion record — 2026-10-03

- Added an application-owned disruption model and a deterministic SHA-256 hash for interpretation-relevant warning content. Provider DTO validation and normalization remain outside this model.
- Hash canonicalization sorts object keys recursively while retaining array order, including German description entries and GeoJSON coordinates. The hash includes warning content, provider timestamp state and `queried_road`; it excludes identity, raw payload, lifecycle and collection metadata.
- `(source, provider_id)` remains the persistence identity and is deliberately excluded from its content hash. A later queried-road update produces a new content hash but does not itself establish impact. Historical replay capture and observation timestamps are excluded; provider timestamps, including omitted versus explicit-null state, remain in the hash.
- No PostgreSQL repository, upsert behavior, collection, resolution processing, HTTP endpoints, matching or AI integration was added.

### CP4.3 completion record — 2026-10-03

- Added a PostgreSQL disruption repository with parameterized identity lookup, active-disruption retrieval and transactional observation upserts. It computes the canonical hash after merging omitted timestamps with existing stored values.
- `(source, provider_id)` is the stable identity. Accepted observations must have a strictly newer `lastSeenAt`; an accepted live observation promotes provenance to LIVE, while replay cannot overwrite a record that has been observed live. Upserts do not infer resolution.
- The single `queried_road` field records the most recently accepted retrieval context. A different road query updates it only when its observation is newer; equal timestamps retain the stored value. It is still not evidence of route impact.
- Added isolated repository tests for insertion, identity lookup, unchanged and changed observations, provider timestamp corrections, missing optional fields, replay precedence, active retrieval and concurrent duplicates.
- Current checks passed: unit tests (8 suites, 18 tests), TypeScript check, focused CP4.3 lint, production build, isolated database tests (6 suites, 21 tests), and PostgreSQL-backed shipment HTTP regression tests (1 suite, 4 tests). The integration runner removed its temporary container and network.

### CP4.4 completion record — 2026-10-03

- Reviewed the migration, application-owned model, canonical hashing and repository together. The unique source/provider identity protects concurrent inserts; `SELECT ... FOR UPDATE` serializes updates. Under the existing PostgreSQL READ COMMITTED isolation, a conflicting insert retries its lookup in a fresh statement snapshot before merging. Concurrent changed observations retain the newest accepted content and stable identity.
- Corrected LIVE insertion to derive `lastLiveSeenAt` from `lastSeenAt`, and use LIVE provenance to reject replay even if an older stored record lacks its live timestamp. New records derive `contentChangedAt` from their accepted observation. Corrected canonicalization to retain JSON keys such as `__proto__`.
- Added focused coverage for concurrent changed content, preserved-timestamp hashing, replay-to-live promotion, transaction rollback, distinct sources and parameterized identity lookups. Existing tests cover new/changed/unchanged observations, explicit nulls, stale observations, replay precedence, nullable fields, original German content, raw payload, geometry and active retrieval. Upserts preserve existing lifecycle state; no resolution execution is present.
- Actual final checks: unit tests passed (8 suites, 19 tests); isolated PostgreSQL tests passed (6 suites, 25 tests); real shipment HTTP tests passed (1 suite, 4 tests), including both complete shipment responses and unknown-ID 404. TypeScript and production build passed. Full lint was run without `--fix` and reports only the pre-existing unused `metadata` error in `src/common/pipes/zod-body-validation.pipe.ts:11`, also present in HEAD. No CP4 lint regression was found. The isolated runner removed its container and network; `git diff --check` passed.
- Remaining assumptions: provider IDs are stable and unique within the configured source, including across categories; `lastSeenAt` is a trusted observation instant rather than an event start time or arbitrary replay execution time. One `queried_road` retains only the latest accepted query context; equal-time observations retain the first stored context. This does not establish an affected road or shipment impact.

**Next checkpoint after CP4:** CP5, subsequently completed as recorded below.

### CP5 implementation and verification

**Status:** Completed — CP5.4 acceptance review, 2026-10-03. The query/page contract, PostgreSQL timezone approach and test-only WARNING subtype fallback were explicitly approved before implementation.

| Step | Delivered scope | Status | Verification gate |
| ---- | --------------- | ------ | ----------------- |
| CP5.1 | Application-owned query types and validation for queried road, category, calendar dates, selected timestamp and pagination | Completed | Focused unit tests for valid dates, exclusive date/range inputs, reversed ranges and pagination defaults/limits |
| CP5.2 | Existing repository extended with parameterized active-state filtering, PostgreSQL Berlin-to-UTC boundary conversion, deterministic ordering and paginated totals | Completed | Isolated PostgreSQL tests for combined filters, inclusive/exclusive UTC comparisons and accurate page totals |
| CP5.3 | Authentic A1 warning retrieval and clearly labeled synthetic boundary controls | Completed | German descriptions/raw payload/GeoJSON preservation; missing timestamps; one-sided ranges; DST days; stable tie ordering and empty pages |
| CP5.4 | Final acceptance review and actual verification record | Completed | Unit, isolated integration and existing shipment HTTP tests; TypeScript, build, non-mutating lint and scope/diff review |

The approved timezone approach uses PostgreSQL's existing timezone support; no application timezone library or custom offset algorithm is planned. UTC remains the standard for stored timestamp instants and internal service communication. Interpret calendar-date inputs with explicit `Europe/Berlin` inside repository SQL, calculate each local midnight independently, and compare converted boundaries directly against the existing indexed `TIMESTAMPTZ` columns. See [Database architecture](../architecture/database.md#cp5-timezone-clarification--approved-2026-10-03) and MVP decision D11.

Verified timezone checks include lower-bound inclusion, upper-bound exclusion, the following local midnight for inclusive `to`, and both spring/autumn DST transitions under differing database session timezones. Missing starts remain excluded from start-date filtering without fallback; end timestamps do not introduce interval-overlap semantics. Reads retain the latest stored state and do not reconstruct historical versions.

CP5 does not add HTTP endpoints, collection, automatic resolution, tracking, matching or AI analysis, and does not alter CP4 upsert, hashing or timestamp-merging behavior.

#### CP5.4 acceptance results — 2026-10-03

- Query validation applies page 1, limit 20/max 100 and `startTimestamp` defaults, rejects conflicting dates/reversed ranges/invalid pagination, and supports optional road/category and selected timestamp filters. The repository returns `{ items, page, limit, total }`.
- Reviewed SQL parameterization: road, category, date boundaries, limit and offset are bound values; timestamp column selection uses a fixed validated mapping. Timestamp comparisons leave the existing indexed columns unmodified. One CTE statement supplies page rows and total from the same snapshot, including zero matches and out-of-range pages.
- Strengthened verification without changing production code: combined road/category/date-range filtering, capture ordering across different timestamps plus equal-time UUID ordering, and both DST days under UTC and America/New_York sessions. The DST test now executes repository SQL on the same client whose timezone is set; it includes the final millisecond of the autumn 25-hour day, so a fixed 24-hour cutoff would fail.
- Confirmed all three authentic A1 warning entries retain their original German descriptions, complete coordinates/GeoJSON and raw provider-item JSON. Application test records use the approved WARNING fallback only when a structured subtype is absent. Synthetic capture metadata and boundary records are test assumptions, not historical provider evidence; no general provider normalization was introduced.
- Actual checks passed: `npm test -- --runInBand` (9 suites, 37 tests), `npm run test:integration` (6 isolated database suites, 37 tests, then 1 real shipment HTTP suite, 4 tests), `npx tsc --noEmit`, `npm run build` and `git diff --check`. The isolated runner removed its temporary PostgreSQL container and network.
- Full non-mutating lint (`npx eslint "{src,apps,libs,test}/**/*.ts"`) exits 1 only for the pre-existing unused `metadata` in `src/common/pipes/zod-body-validation.pipe.ts:11`, confirmed in the CP4 baseline commit. No CP5 lint findings remain.
- Compared CP5 with the CP4 baseline: migration, disruption model/hash, database infrastructure, dependencies and authentic payload are unchanged. Repository row mapping and write paths remain intact; existing concurrency, replay/staleness, timestamp merging, explicit-null and lifecycle tests pass.
- Remaining limits: latest state cannot reconstruct historical warnings; one `queriedRoad` retains only the latest retrieval context; offset pages can shift between separate requests when data changes. These are documented MVP assumptions, not shipment impact evidence. Full lint still needs separate cleanup of its existing finding.

### Accelerated Iteration A — warning collection and retrieval

**Status:** Implemented and fixture-verified 2026-10-04; final review pending.

- Added PostgreSQL-backed `GET /disruptions` and `GET /disruptions/:id` using the approved query/page contract. List input maps HTTP `road` to the application `queriedRoad` field; invalid query input is rejected at the HTTP boundary.
- Added a warning-only official Autobahn client with a 5-second request timeout and at most two total attempts for transient failures. It validates the warning envelope, URL-encodes the road component, rejects redirects and does not retry malformed or invalid provider responses.
- Added a provider-boundary warning normalizer and a collection service that preserves original German descriptions, GeoJSON, raw payload and timestamp-presence semantics before using the CP4 repository upsert. Per-record failures produce a partial result without discarding valid records.
- Added `POST /integrations/autobahn/collect`. It returns 404 unless `AUTOBANH_COLLECTION_ENABLED=true` in a non-production process; the route is always disabled in production. No scheduler, automatic resolution or closure collection was added.
- Added the explicit `replay:autobahn:a1:demo` command. It requires `--demo` and `LIEFERRADAR_DEMO_DATABASE_URL` pointing to a separately configured local `lieferradar_demo_*` database, then imports the authentic A1 fixture as `REPLAY` observations. It never falls back to the development database.
- Actual checks passed: unit tests (14 suites, 53 tests), isolated PostgreSQL tests (6 suites, 37 tests), and real NestJS HTTP tests (1 suite, 9 tests). TypeScript, production build, focused lint and `git diff --check` also passed. The isolated runner removed its temporary PostgreSQL container and network.
- A read-only live probe of the official A1 warning endpoint completed successfully on 2026-10-04 and returned one record. It did not persist provider data. The development database was not modified during verification.
- Full non-mutating lint has one pre-existing error: unused `metadata` in `src/common/pipes/zod-body-validation.pipe.ts:11`. No Iteration A file has a lint finding. The replay command was also checked without a demo database URL and failed safely before connecting; replay execution remains pending a separately provisioned demo database.

The approved accelerated sequence is recorded in [Accelerated MVP delivery](../product/accelerated-delivery.md). Iteration B starts only after review; it will add the verified A1 route, simulator, conservative matching and the simple frontend.

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
- [x] Verify development-backed application connectivity when registering persistence at CP3.

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
| source          | TEXT            | Original provider                  |
| provider_id     | TEXT            | External event identifier          |
| category        | TEXT            | WARNING or CLOSURE                 |
| disruption_type | TEXT            | Provider event type                |
| queried_road    | TEXT            | Motorway used for retrieval        |
| title           | TEXT            | Original event title               |
| subtitle        | TEXT            | Original directional subtitle      |
| description     | JSONB           | Original German description        |
| start_timestamp | TIMESTAMPTZ     | Provider-reported event start      |
| start_timestamp_present | BOOLEAN  | Whether the provider supplied start |
| end_timestamp   | TIMESTAMPTZ     | Provider-reported event end        |
| end_timestamp_present | BOOLEAN    | Whether the provider supplied end  |
| future          | BOOLEAN         | Provider-reported future indicator |
| abnormal_traffic_type | TEXT      | Nullable provider traffic type     |
| delay_minutes   | INTEGER         | Nullable reported delay in minutes |
| average_speed_kmh | INTEGER       | Nullable reported speed in km/h    |
| coordinate      | JSONB           | Original event coordinate          |
| geometry        | JSONB           | Original GeoJSON geometry          |
| raw_data        | JSONB           | Complete original API payload      |
| content_hash    | TEXT            | Canonical interpretation-relevant SHA-256 |
| lifecycle_status | TEXT           | ACTIVE or RESOLVED                 |
| resolved_at     | TIMESTAMPTZ     | Resolution timestamp, when resolved |
| ingestion_mode  | TEXT            | LIVE or REPLAY                     |
| captured_at     | TIMESTAMPTZ     | First capture timestamp            |
| last_seen_at    | TIMESTAMPTZ     | Most recent accepted observation   |
| last_live_seen_at | TIMESTAMPTZ   | Most recent live observation       |
| content_changed_at | TIMESTAMPTZ  | Most recent content version        |

Use nullable fields where the external API does not guarantee values.

Missing optional fields remain null, including the three traffic fields. Avoid restrictive provider-specific enums; preserve unfamiliar traffic types as text and unknown payload fields in `raw_data`.

Preserve original German text without translation or modification.

Store geographic geometry as JSONB.

GeoJSON uses `[longitude, latitude]` coordinate ordering. Do not reverse coordinates during persistence.

### Ingestion provenance

`ingestion_mode` distinguishes live collection from historical replay. `queried_road` records retrieval context, not a conclusion that every carriageway or route is affected.

The identity is `(source, provider_id)`. `content_hash` is a canonical hash of fields relevant to later interpretation; it does not preclude assessment of a newly relevant shipment.

Presence flags distinguish an omitted provider timestamp from an explicit `null`. Later provider timestamp corrections may update the stored provider timestamp.

If a previously replayed event is subsequently observed through the live API, update its provenance appropriately. Stale observations and replay data must not overwrite newer live state.

The provisional resolution policy requires absence from two consecutive complete, successful collections for the same source and queried road. Failed or incomplete collections never resolve a warning. CP4.1 stores lifecycle fields only; it does not execute resolution.

Preserve the original payload for traceability.

## A4. Indexes and constraints

Create the following indexes through database migrations:

```sql
CREATE UNIQUE INDEX idx_disruptions_source_provider_id
ON disruptions(source, provider_id);

CREATE INDEX idx_disruptions_start_timestamp
ON disruptions(start_timestamp);

CREATE INDEX idx_disruptions_captured_at
ON disruptions(captured_at);

CREATE INDEX idx_disruptions_queried_road_lifecycle_category_start
ON disruptions(queried_road, lifecycle_status, category, start_timestamp);
```

The unique index prevents duplicate disruption records.

Timestamp indexes support date-based retrieval.

The composite index supports filtering by queried motorway, lifecycle, category and event start date.

Do not introduce PostGIS or additional spatial indexes in this iteration.

## A5. Disruption repository

Implement a PostgreSQL-backed disruption repository supporting:

- Insert.
- Upsert.
- Retrieve by internal UUID.
- Retrieve by source and provider identifier.
- Filter by motorway and category.
- Filter by date or date range.
- Paginated retrieval.

Upsert behavior:

- Insert new events.
- Update existing events without creating duplicates.
- Preserve `captured_at`.
- Update `last_seen_at` when the event is observed again.
- Support provider timestamp corrections while preserving omitted-versus-explicit-null semantics.
- Never allow stale observations or replay data to overwrite newer live state.

Resolution execution remains outside CP4. It will use the provisional two-consecutive-complete-collection policy recorded above.

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
- Use UTC for stored timestamp instants and internal service communication; interpret date-only filters using `Europe/Berlin`.
- Convert local calendar boundaries to UTC instants inside PostgreSQL using explicit `AT TIME ZONE 'Europe/Berlin'`; compare them directly against indexed `TIMESTAMPTZ` columns.
- Calculate each local midnight independently, including midnight after the `to` date. Do not derive the upper UTC bound by adding 24 hours; handle DST without a new timezone dependency.
- Use inclusive start and exclusive end timestamps.
- Reject invalid dates and reversed ranges.
- Do not combine `date` with `from` or `to`.
- Support pagination with stable ordering.

A date filter identifies events by their selected timestamp. It does not establish that they remained active throughout that date.

Date queries select the latest stored state of collected or imported events by their current selected timestamp. They do not reconstruct historical versions or lifecycle state on the requested date.

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
