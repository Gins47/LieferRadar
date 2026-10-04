# Iteration 003 — AI Disruption Demonstration

**Project:** LieferRadar<br>
**Status:** Plan approved; implementation not started<br>
**Approval date:** 2026-10-04<br>
**Dependencies:** Iterations 001 and 002; existing NestJS and Python services<br>
**Budget:** Six development hours, including verification

Authority: [MVP scope and decision register](../product/mvp-scope.md), decisions D16–D21. See [Accelerated delivery](../product/accelerated-delivery.md) and [Database architecture](../architecture/database.md). This specification combines the essential route/simulation and AI work from the earlier Iterations B and C. Approval of this document does not authorize application implementation in the current documentation task.

## Goal and scope

Demonstrate one complete flow:

```text
Saved route → simulated vehicle → authentic historical warning
    → NestJS verified evidence → Python reasoning → structured operator result
```

Use `SHP-002` (Lübeck → Hamburg, A1), one recorded warning, one fictional vehicle/driver and the existing PostgreSQL and FastAPI foundations. Preserve existing shipment HTTP responses, fixtures and disruption persistence semantics.

The mandatory outcome is a working backend assessment flow. A Next.js map is optional and strictly time-limited. A documented HTTP/JSON demonstration is an acceptable frontend fallback. Completing this iteration does not complete the full MVP: recording human approval/rejection remains deferred.

## Architecture

| Component | Responsibility |
| --------- | -------------- |
| NestJS `src/demo/` | Thin controller, simulation service, static route loading, deterministic evidence preparation and assessment orchestration |
| NestJS `src/demo/repository/` | Parameterized PostgreSQL access to latest fictional vehicle state through the existing `DatabaseService` |
| NestJS `src/integrations/ai/` | Bounded HTTP call to Python; versioned Zod request/response validation |
| Python `api/routes/disruption.py` | Thin asynchronous `POST /analysis/disruption` route with Pydantic request and response models |
| Python `reasoning/disruption.py` | Evidence handling, bounded structured LLM invocation and output validation |
| Python `llm/clients.py`, `prompts/disruption_assessment.py` | Reuse installed `langchain-openai`; keep client configuration and prompts at existing service boundaries |
| Optional `services/web` | One Next.js page with React Leaflet, vehicle controls and assessment output; allowlisted server forwarding to NestJS |

NestJS remains the source of supply-chain facts and deterministic checks. Python returns reasoning and human-review recommendations; it never writes supply-chain state. No RAG or Python database migration is required for assessment. Retain existing embedding/ingestion functionality and avoid legacy ticket dependencies.

### Route and vehicle storage

Load the approved route file as an immutable local artifact, validate it and bind the simulation to its SHA-256 hash. No route table or route management is required. Local build/start instructions must specify access to the route file; it is currently outside NestJS build output.

Add one explicit migration for `demo_vehicle_state`:

| Field | Purpose |
| ----- | ------- |
| `shipment_id` | Primary key and foreign key to the existing shipment |
| `vehicle_id` | Fictional vehicle identifier |
| `driver` | Fictional name/contact JSONB metadata, not a separate driver feature |
| `route_hash` | Identity of the route artifact used by the simulation |
| `elapsed_seconds` | Nonnegative simulated progress through the journey |
| `position` | Latest validated longitude/latitude JSONB |
| `simulated_at` | Historical simulated timestamp, stored as `TIMESTAMPTZ` |
| `revision` | Nonnegative revision for atomic updates and duplicate/stale request protection |
| `updated_at` | Real persistence timestamp, stored as `TIMESTAMPTZ` |

Use practical checks, foreign keys and repository transactions. Persist only latest state. Example identifiers are `VEH-DEMO-002`, `Alex Demo` and `driver-shp002@example.invalid`; no real contact information or phone number is necessary. Exclude contact metadata from LLM inputs.

An explicit demo preparation command reuses logistics fixture seeding and recorded-warning replay with the existing local `lieferradar_demo_*` database guard. Do not weaken development seed restrictions. Migrations and setup remain explicit; startup performs neither. Automated database tests use the isolated runner and cannot fall back to development.

### Simulation and HTTP contracts

Reset to the first route coordinate and `2026-10-03T06:30:00.000Z`. Advance by bounded whole-number seconds, defaulting to ten simulated minutes. Apply elapsed progress proportionally to the existing two-hour shipment window ending `2026-10-03T08:30:00.000Z`; interpolate by route distance and clamp at the destination. This is synthetic playback, not an ORS ETA or traffic model. Never modify shipment status automatically.

| Endpoint | Input and result |
| -------- | ---------------- |
| `GET /demo/shipments/:id` | SHP-002 view, route/provenance, fictional vehicle/driver, latest simulation state and selected warning |
| `POST /demo/shipments/:id/reset` | `{ expectedRevision }` → updated simulation state |
| `POST /demo/shipments/:id/advance` | `{ seconds, expectedRevision }` → updated simulation state |
| `POST /demo/shipments/:id/assessment` | `{ disruptionId, expectedRevision }` → versioned structured assessment |
| Python `POST /analysis/disruption` | Bounded authoritative evidence → validated assessment |

Support SHP-002 only in this demonstration. Use atomic revision checks: a stale reset/advance request returns `409` and cannot apply twice. NestJS reads shipment, warning and vehicle facts itself; browser-supplied identifiers are not evidence. Existing `/shipments/:id` and `/disruptions` contracts remain unchanged. HTTP disruption filtering uses `road=A1`, mapped internally to `queriedRoad`.

## Data provenance and route evidence

| Data | Provenance and limitation |
| ---- | ------------------------- |
| [A1 warnings](../../services/api/test/fixtures/autobahn/a1-warnings-2026-10.03.json) | Authentic historical provider response; preserve German text, geometry, original timestamps and unknown payload fields |
| Selected warning | `INRIX--vi-avl.2026-10-03_06-53-00-000_003.de0`, Bargteheide–Ahrensburg, explicit `Lübeck -> Hamburg`, start `2026-10-03T06:53:00Z`; no end timestamp |
| [Route export](../../services/api/test/fixtures/routes/luebeck-hamburg-a1.geojson) | Supplied ORS export, `driving-car`, 644 coordinates, provider distance 68,242.2 m; metadata timestamp `2026-10-04T06:47:53.593Z` |
| Route attribution | `openrouteservice.org \| OpenStreetMap contributors`; source metadata supports provenance but is not an independent authenticity signature |
| Route SHA-256 | `ecd9ff4cb5c273041800dec3912bacbd5c856f7a8a522c9f63ed3477d0ee2a2a` |
| SHP-002 and vehicle | Fictional shipment, locations, driver, movement and two-hour schedule; see [Shipment scenario](../research/a1-shipment-scenario.md) |

Passenger-car geometry is accepted for this simulated demonstration only. It does not verify HGV legality, warehouse accessibility or historical road conditions. Preserve the original export; do not relabel its profile or timestamps.

Earlier read-only planning measurements used a local projection and warning samples spaced no more than 25 m apart: the selected warning is approximately 2.32 km long, at route distance 36.54–38.86 km; all 104 samples were within approximately 0.67 m of the route. The opposite-direction warning (`..._007.de0`) was approximately 16–19 m away. These are preliminary experimental results, not completed B1 acceptance or carriageway proof; record the method and repeat the checks during B1.

The warning start falls inside the shipment window, but its missing end prevents confirming duration. Collection time, provider time, route capture time and simulated time are separate facts. Latest-state records cannot reconstruct history. Do not imply a warning was observed before its capture, or present later LIVE content as the recorded historical warning. Preserve replay precedence; historical demonstration configuration disables live synchronization rather than overwriting newer LIVE state.

## Deterministic evidence and AI contract

NestJS prepares proximity to the remaining route, ahead/behind evidence, explicit direction compatibility, timing compatibility and provenance limitations. `queriedRoad` is retrieval context. Coordinate ordering is not sufficient direction evidence. Start with a documented experimental 25 m candidate tolerance; geometry alone does not prove relevance. Missing geometry, direction or timestamps remain explicit.

Known opposite direction, an affected section entirely behind the vehicle, or known non-overlapping timing produces a deterministic exclusion that AI cannot override. Missing event end is uncertainty, not an invented duration or automatic resolution. Preserve provider timestamp omission versus explicit null.

### Version 1 wire schemas

The following schemas define the intended service contract, not existing implementation. Use UTC ISO strings for instants, Pydantic in Python and Zod in NestJS. Bound strings, arrays, geometry size and request size during implementation.

```ts
type JsonValue = null | boolean | number | string
  | JsonValue[] | { [key: string]: JsonValue };
type Position = [longitude: number, latitude: number];
type ProviderTimestamp =
  | { kind: 'omitted' }
  | { kind: 'explicit-null' }
  | { kind: 'value'; value: string };

interface AssessmentContext {
  shipmentId: string;
  routeHash: string;
  vehicleRevision: number;
  simulatedAt: string;
  disruptionId: string;
  warningContentHash: string;
}

interface EvidenceFact {
  id: string;
  kind: 'PROVIDER' | 'ROUTE' | 'SIMULATED' | 'DETERMINISTIC' | 'LIMITATION';
  sourceRef: string; // e.g. warning.subtitle or route.metadata.query.profile
  value: JsonValue;
}

interface DisruptionAssessmentRequest {
  contractVersion: '1';
  requestId: string;
  context: AssessmentContext;
  shipment: {
    pickupCity: string;
    destinationCity: string;
    plannedRoute: string[];
    pickupAt: string;
    plannedDeliveryAt: string;
  };
  route: {
    profile: 'driving-car';
    distanceMetres: number;
    capturedAt: string;
    attribution: string;
  };
  vehicle: {
    vehicleId: string;
    simulated: true;
    position: Position;
    distanceAlongRouteMetres: number;
  };
  warning: {
    source: string;
    providerId: string;
    ingestionMode: 'LIVE' | 'REPLAY';
    capturedAt: string;
    lastSeenAt: string;
    queriedRoad: string;
    title: string;
    subtitle: string | null;
    description: string[];
    startTimestamp: ProviderTimestamp;
    endTimestamp: ProviderTimestamp;
    delayMinutes: number | null; // reported warning delay, not shipment delay
    geometry: JsonValue;
  };
  deterministicChecks: {
    geographic: 'NEAR_REMAINING_ROUTE' | 'DISTANT' | 'UNKNOWN';
    minimumDistanceMetres: number | null;
    toleranceMetres: number;
    routePosition: 'AHEAD_OR_ALONGSIDE' | 'BEHIND' | 'UNKNOWN';
    direction: 'COMPATIBLE' | 'CONFLICTING' | 'UNKNOWN';
    timing: 'POSSIBLE' | 'CONFLICTING' | 'UNKNOWN';
    exclusionReasons: string[];
  };
  facts: EvidenceFact[];
}

interface DisruptionAssessment {
  contractVersion: '1';
  requestId: string;
  context: AssessmentContext;
  relevance: 'POSSIBLE' | 'UNLIKELY' | 'INSUFFICIENT_EVIDENCE';
  supportingEvidence: Array<{ factIds: string[]; explanation: string }>;
  missingEvidence: string[];
  uncertainty: string[];
  possibleConsequences: string[];
  recommendedActions: Array<{
    action: 'MONITOR' | 'VERIFY_INFORMATION' | 'REVIEW_PLAN';
    rationale: string;
    requiresHumanReview: true;
  }>;
}
```

Service code attaches trusted context and request IDs; these are not generated by the LLM. Validate returned fact references against the supplied set. Unsupported references or contradictory claims fail validation. Inference and possible consequences must remain distinct from supplied facts. Do not offer `CONFIRMED_IMPACT` or invented numeric shipment delays/ETAs. The provider's 18-minute report may be cited with its source and limitations.

Use one asynchronous structured LLM invocation through the existing client boundary, with an approximately 25-second overall reasoning deadline, automatic retries disabled initially, bounded output and a slightly longer NestJS HTTP timeout. Configure a model with structured-output support and verify account access. Preserve FastAPI `response_model` validation and validate again in NestJS. Log request ID, model, duration and outcome without secrets/contact information. Treat provider text as untrusted data, not instructions.

Timeout, provider failure or invalid output returns an explicit assessment-unavailable error; retain deterministic evidence for display. No fabricated success or automatic action. Changing vehicle revision or warning content invalidates displayed assessment context; do not deduplicate solely by warning hash or add assessment caching.

## Checkpoints and verification

Commands below are planned acceptance commands. New files, scripts and the web package do not exist yet. Existing database/HTTP checks must run through `test:integration`, never direct database-backed Jest execution against development. Time spent testing and documenting belongs within each checkpoint budget; B6 is the final consolidated review.

| Checkpoint | Budget | Dependencies | Deliverable |
| ---------- | ------ | ------------ | ----------- |
| B1 | 30 min | Existing route and warning fixtures | Verified artifact/provenance and documented limitations |
| B2 | 60 min | B1 evidence and version 1 contract | Python structured reasoning and mocked evaluation |
| B3 | 90 min | B1 route; existing database infrastructure | Latest vehicle persistence, explicit setup, simulation APIs |
| B4 | 90 min | B2 and B3 | NestJS evidence, Python HTTP integration, real backend flow |
| B5 | 45 min target; 60 min hard maximum | B3/B4 APIs | Optional Next.js map and assessment controls |
| B6 | 30 min | B1–B4; B5 delivered or time-limit fallback | Final regression/evaluation record and walkthrough |

Target 345 minutes plus 15 minutes contingency. Protect the combined 150-minute B2/B4 AI allocation. If earlier work overruns, cut frontend work first; do not silently defer vehicle persistence or factual safeguards.

### B1 — Route verification and integration preparation

**Tasks:** Validate feature/type/count, finite WGS84 coordinates, endpoints, routing metadata and SHA-256. Repeat warning/route comparison, inspect travel direction and corridor, and record sampling/projection limits in route verification documentation. Confirm no runtime routing dependency.

**Acceptance:** The static artifact supports the intended simulated corridor; passenger-car and subsequent-capture limitations are explicit. Missing warning end and opposite-carriageway proximity remain documented. Do not label actual shipment impact verified.

**Verification commands** (repository root):

```bash
shasum -a 256 services/api/test/fixtures/routes/luebeck-hamburg-a1.geojson
node -e 'const fs=require("node:fs"); const r=JSON.parse(fs.readFileSync("services/api/test/fixtures/routes/luebeck-hamburg-a1.geojson","utf8")); const f=r.features[0]; if(r.type!=="FeatureCollection" || r.features.length!==1 || f.geometry.type!=="LineString" || f.geometry.coordinates.length!==644) throw new Error("unexpected route shape"); console.log({summary:f.properties.summary, metadata:r.metadata});'
git diff --check
```

Record the additional offline comparison method/results; the commands above alone do not establish corridor or direction suitability.

### B2 — Python structured reasoning

**Tasks:** Add Pydantic contract schemas, thin route, prompt and reasoning service; configure chat client separately from embeddings. Add mocked relevant, opposite-direction and insufficient-evidence cases, invalid references/output and timeout handling. Do not import ignored legacy ticket modules or query RAG.

**Acceptance:** Validated version 1 results cite supplied facts, preserve uncertainty and recommend human review. Deterministic exclusions cannot become positive impact claims. Failures have explicit HTTP semantics; no supply-chain writes occur.

**Verification commands** (from `services/ai-service`):

```bash
uv run --locked python -m unittest discover -s tests -p 'test_*.py' -v
uv run --locked python -c 'from main import app; assert any(r.path == "/analysis/disruption" for r in app.routes)'
```

Use mocked calls for automated tests; verify FastAPI request/response behavior using the installed HTTP tooling. Configured key/model access remains a separate live gate in B4.

### B3 — Vehicle persistence and simulator

**Tasks:** Add one `node-pg-migrate` migration and concrete repository; explicit demo preparation; static route loader; reset/advance/read APIs with validation and atomic revision protection. Persist fictional state; reject route-hash mismatches. Bind local processes to loopback and guard demonstration mutations. Adapt existing rollback tests, which currently assume exactly two migrations, and restore schema in `finally`.

**Acceptance:** Same reset/advance sequence reproduces positions and timestamps after restart. Progress is bounded, duplicate/stale advancement cannot apply twice, and SHP-001/SHP-002 contracts and shipment status remain unchanged. Explicit setup can target only the eligible demo database. Isolated tests prove persistence and cleanup.

**Verification commands** (repository root):

```bash
npm --prefix services/api run test -- --runInBand
npm --prefix services/api run test:integration
npm --prefix services/api run build
git diff --check
```

Also run `npx tsc --noEmit --incremental false` and focused `npx eslint "src/demo/**/*.ts"` from `services/api`. Demo preparation and local migration commands must be documented with an explicitly validated demo target; do not run development migrations/seeds as a substitute.

### B4 — Complete backend assessment

**Tasks:** Prepare deterministic remaining-route, direction, timing and provenance evidence; add AI client and validated assessment API; log bounded-call outcomes. Perform one real NestJS → FastAPI → LLM assessment. Add a separate explicit-live evaluation script for the three cases; do not make live calls part of normal tests.

**Acceptance:** The SHP-002 historical scenario yields a validated result with source-backed evidence and uncertainty. Opposite-direction, behind-vehicle and conflicting-timing controls are excluded; insufficient data stays explicit. Database and Python errors propagate appropriately. New vehicle context can receive a new assessment without a warning-content change.

**Verification commands:** Repeat API unit, isolated integration/HTTP, TypeScript and focused lint checks from B3; repeat B2 Python tests. For the explicit local smoke check (only after enabling demo controls and selecting the demo database):

```bash
curl --fail-with-body http://127.0.0.1:3000/demo/shipments/SHP-002
```

Use its current revision/disruption ID in documented POST reset/advance/assessment requests. Run the planned live evaluation from `services/ai-service`:

```bash
uv run --locked python scripts/evaluate_disruption.py --live
```

Record actual model, timing and case outcomes. A valid schema alone is not evidence of factual correctness. Invalid credentials/quota/model access blocks the real-AI acceptance gate; a mocked result is not an equivalent success.

### B5 — Optional map prototype

**Tasks:** One Next.js page, client-only React Leaflet map, OSM tiles/attribution, route/vehicle/warning layers, reset/advance/assess controls, historical clock and assessment text. Server-only backend configuration; allowlisted forwarding. No dashboard, elaborate styling or synchronization feature expansion.

**Acceptance:** A reviewer can see the scenario and request/display assessment with honest loading/error/provenance states. Bind web to loopback. Stop after 60 minutes even if incomplete and document the HTTP/JSON fallback. Tile failure must not prevent assessment output; no tile prefetch/offline cache infrastructure.

**Verification commands** (planned web scripts, repository root):

```bash
npm --prefix services/web run typecheck
npm --prefix services/web run lint
npm --prefix services/web run build
```

Manually verify reset, advance, assess and error display. Avoid introducing a browser-test framework for this time-limited prototype.

### B6 — Final acceptance and review

**Tasks:** Run complete regression checks, review SQL/input/output validation and diff, demonstrate persisted restart and one real assessment, document model/route/timing limitations and frontend disposition. Update all checkpoint results and MVP progress without expanding scope.

**Verification commands:** API unit, isolated integration/HTTP and build commands from B3; Python tests/import check from B2; web checks from B5 if delivered. From `services/api`, run:

```bash
npx tsc --noEmit --incremental false
npx eslint "{src,apps,libs,test}/**/*.ts"
```

From the repository root, run `git diff --check` and review `git diff` plus new files. Keep lint non-mutating; distinguish the previously reported unused `metadata` finding from new regressions. Run `test:integration:cleanup` only if the runner/teardown changes. Verify disabled/production mutation 404 behavior and existing shipment HTTP regressions within the isolated suite.

**Acceptance:** Saved route → persisted fictional vehicle → authentic historical warning → deterministic evidence → real Python AI call → validated human-review result is demonstrated. Original warning content and shipment APIs remain intact. Every required check has an actual result; blocked checks are not passes. Stop for review; no commit/push or later checkpoint authorization is implied.

## Constraints and deferrals

- Operate on loopback with a separate eligible demo database; keep development untouched. Mutations are disabled by default and unavailable in production. Credentials stay server-side.
- Authentication infrastructure is deferred, not approval for public exposure. Existing local guard requirements remain mandatory.
- No automatic rerouting, cancellation, driver notifications or shipment-status changes. Recommendations require human review; recording approval/rejection is deferred and remains required for full MVP completion.
- No runtime routing, route database/management, background workers, GPS, position history, warning history, automatic resolution or synchronization.
- No RAG requirement, new Python database schema, assessment persistence/cache or general fleet/driver management.
- React Leaflet/OSM is an approved optional dependency exception to the earlier map-SDK deferral. Preserve attribution, respect tile-service limits and keep assessment usable without tiles.
- If persistence or a real LLM call cannot be completed, report the specific blocker. Do not silently substitute in-memory persistence, fabricated geometry or mock AI as completed acceptance.

## Progress tracking

Update this checklist and table after each checkpoint. Record date, commands, exit/results, manual/live evidence, actual time, blockers and remaining issues. A started checkpoint is not complete because its time budget expired.

- [ ] B1 — Route/provenance accepted.
- [ ] B2 — Python structured reasoning and mocked cases verified.
- [ ] B3 — Latest vehicle persistence and deterministic APIs verified.
- [ ] B4 — Real backend assessment and evaluation verified.
- [ ] B5 — Frontend delivered or time-limit fallback explicitly recorded.
- [ ] B6 — Final acceptance and diff review completed.

| Checkpoint | Status | Verification results | Outstanding issues |
| ---------- | ------ | -------------------- | ------------------ |
| B1 | Not started | Preliminary planning measurements only; route metadata/hash rechecked during documentation preparation | Final direction/corridor review and reproducible method record |
| B2 | Not started | No checkpoint tests run | Implement contract/reasoning; choose accessible structured-output model |
| B3 | Not started | No checkpoint tests run | Migration, demo preparation, route loading and persistence |
| B4 | Not started | No real LLM assessment or evaluation run | Key/quota/model access and end-to-end integration |
| B5 | Not started; optional | No frontend checks run | 45-minute target / 60-minute maximum; retain fallback |
| B6 | Not started | No final acceptance checks run | Await required checkpoints; document incomplete work honestly |

This document records an approved plan. The current task adds documentation only; no checkpoint implementation, migration, seeding, live collection or LLM invocation has been performed.
