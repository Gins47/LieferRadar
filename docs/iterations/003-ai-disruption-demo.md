# Iteration 003 — AI Disruption Demonstration

**Project:** LieferRadar<br>
**Status:** B1–B2 accepted; B3.1–B3.2 complete; B3.3–B6 not started<br>
**Approval date:** 2026-10-04<br>
**Dependencies:** Iterations 001 and 002; existing NestJS and Python services<br>
**Budget:** Six development hours, including verification

Authority: [MVP scope and decision register](../product/mvp-scope.md), decisions D16–D24. See [Accelerated delivery](../product/accelerated-delivery.md) and [Database architecture](../architecture/database.md). This specification combines the essential route/simulation and AI work from the earlier Iterations B and C.

### Implementation clarifications approved before B1

1. Demo preparation must load the selected historical warning by its exact `(source, providerId)` and verify that the persisted record has `ingestionMode: REPLAY`. It must fail if that record is absent or if newer `LIVE` state prevents replay; it must never silently substitute a different or newer warning.
2. NestJS selects candidates and skips the Python call for a definite deterministic exclusion. Python rejects a request containing a documented definite-exclusion state, so an accidental cross-service call cannot turn it into an AI result. Uncertain or incomplete evidence remains eligible for AI assessment.
3. Every assessment is bound to the requested `vehicleRevision` and `warningContentHash`. NestJS must reject or require a fresh assessment if either current value differs when it would return the result.

NestJS retains vehicle revision and warning content hash for current-state validation; neither enters the Python contract.

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

Add one explicit migration for `demo_vehicle_state` and `demo_vehicle_shipments`. Vehicle state is keyed by `vehicle_id`; the assignment table has `shipment_id` as its primary key and refers to the vehicle. This permits one fictional vehicle to carry several shipments while each shipment has at most one current assignment. It does not retain assignment history.

| Field | Purpose |
| ----- | ------- |
| `vehicle_id` | Primary key for the fictional vehicle's latest state |
| `driver` | Fictional name, email and phone JSONB metadata, not a separate driver feature |
| `route_hash` | Identity of the route artifact used by the simulation |
| `elapsed_seconds` | Nonnegative simulated progress through the journey |
| `position` | Latest validated longitude/latitude JSONB |
| `simulated_at` | Historical simulated timestamp, stored as `TIMESTAMPTZ` |
| `revision` | Nonnegative revision for atomic updates and duplicate/stale request protection |
| `updated_at` | Real persistence timestamp, stored as `TIMESTAMPTZ` |

Use practical checks, foreign keys and repository transactions. Persist only latest state. Example identifiers are `VEH-DEMO-002`, `Alex Demo`, `driver-shp002@example.invalid` and a fictional phone number; do not use real contact information. Exclude contact metadata from LLM inputs.

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

A calculated distance outside the configured tolerance, known opposite direction, an affected section entirely behind the vehicle, or known non-overlapping timing produces a deterministic exclusion that AI cannot override. Missing event end is uncertainty, not an invented duration or automatic resolution. Preserve provider timestamp omission versus explicit null.

### Version 1 wire schemas

The following schemas define the compact NestJS-to-Python reasoning contract. Use UTC ISO strings for instants, Pydantic in Python and Zod in NestJS. NestJS owns raw geometry, coordinates, hashes, revisions and current-state consistency checks; Python receives only prepared evidence and does not calculate geographic values.

```ts
type ProviderTimestamp =
  | { kind: 'omitted' }
  | { kind: 'explicit-null' }
  | { kind: 'value'; value: string };

interface EvidenceReference {
  id: string;
}

interface DisruptionAssessmentRequest {
  assessmentId: string;
  shipment: {
    id: string;
    pickupCity: string;
    destinationCity: string;
    pickupAt: string;
    plannedDeliveryAt: string;
  };
  vehicle: {
    id: string;
    simulated: true;
    simulatedAt: string;
  };
  disruption: {
    evidenceId: string;
    source: string;
    providerId: string;
    ingestionMode: 'LIVE' | 'REPLAY';
    capturedAt: string;
    queriedRoad: string;
    title: string;
    subtitle: string | null;
    descriptions: string[];
    startTimestamp: ProviderTimestamp;
    endTimestamp: ProviderTimestamp;
    delayMinutes: number | null;
  };
  checks: {
    geographic: EvidenceReference & {
      state: 'NEAR_REMAINING_ROUTE' | 'DISTANT' | 'UNKNOWN';
      distanceMetres: number | null;
      toleranceMetres: number | null;
    };
    direction: EvidenceReference & {
      state: 'COMPATIBLE' | 'CONFLICTING' | 'UNKNOWN';
    };
    routePosition: EvidenceReference & {
      state: 'AHEAD_OR_ALONGSIDE' | 'BEHIND' | 'UNKNOWN';
    };
    timing: EvidenceReference & {
      state: 'POSSIBLE' | 'CONFLICTING' | 'UNKNOWN';
    };
  };
  limitations: Array<EvidenceReference & { description: string }>;
}

interface DisruptionAssessment {
  assessmentId: string;
  operatorMessage: string;
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

NestJS must not call Python when any high-confidence check establishes a definite exclusion: `DISTANT` geographic evidence (with a calculated distance and tolerance), `CONFLICTING` direction, `BEHIND` route position, or `CONFLICTING` timing. Each means the backend has sufficient factual evidence for that check; `UNKNOWN` and missing data never establish exclusion. Python rejects requests containing those states, so a faulty integration fails rather than producing an AI result. Python owns `assessmentId` and response metadata; the LLM returns only the reasoning fields.

All `operatorMessage`, evidence explanations, missing-evidence statements, uncertainty, possible consequences and action rationales are English. Stable evidence IDs consist of the disruption evidence ID, each check ID and each limitation ID. Python validates returned references against that set. Every supplied limitation must be cited in `supportingEvidence`, where its explanation makes it visible to the operator; known limitations remain distinct from information genuinely absent from the request. Original German descriptions and relevant provider times remain available as untrusted evidence, while raw GeoJSON, coordinates, raw payload, route hashes, warning hashes and vehicle revisions never enter the Python contract or LLM prompt. Inference and possible consequences must remain distinct from supplied facts. Do not offer `CONFIRMED_IMPACT` or invented numeric shipment delays/ETAs. The provider's 18-minute report may be cited with its source and limitations.

Use one asynchronous structured LLM invocation through the existing client boundary, with an approximately 25-second overall reasoning deadline, automatic retries disabled initially, bounded output and a slightly longer NestJS HTTP timeout. Configure a model with structured-output support and verify account access. Preserve FastAPI `response_model` validation and validate again in NestJS. Log assessment ID, model, duration and outcome without secrets/contact information. Treat provider text as untrusted data, not instructions.

Timeout, provider failure or invalid output returns an explicit assessment-unavailable error; retain deterministic evidence for display. No fabricated success or automatic action. NestJS invalidates an assessment if its retained vehicle revision or warning content hash no longer matches current state; do not deduplicate solely by warning hash or add assessment caching.

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
node services/api/scripts/verify-luebeck-hamburg-a1-route.js
shasum -a 256 services/api/test/fixtures/routes/luebeck-hamburg-a1.geojson
node -e 'const fs=require("node:fs"); const r=JSON.parse(fs.readFileSync("services/api/test/fixtures/routes/luebeck-hamburg-a1.geojson","utf8")); const f=r.features[0]; if(r.type!=="FeatureCollection" || r.features.length!==1 || f.geometry.type!=="LineString" || f.geometry.coordinates.length!==644) throw new Error("unexpected route shape"); console.log({summary:f.properties.summary, metadata:r.metadata});'
git diff --check
```

Record the additional offline comparison method/results; the commands above alone do not establish corridor or direction suitability.

### B2 — Python structured reasoning

**Tasks:** Add Pydantic contract schemas, thin route, prompt and reasoning service; configure chat client separately from embeddings. NestJS selects candidates; Python rejects documented definite-exclusion states and reasons only about valid candidates. Add mocked candidate, opposite-direction rejection, insufficient-evidence, invalid references/output and timeout cases. All human-readable result fields are English. Do not import ignored legacy ticket modules or query RAG.

**Acceptance:** Validated version 1 candidate explanations cite supplied facts, preserve uncertainty, use English human-readable output and recommend human review. Definite exclusions cannot become AI results; incomplete evidence remains assessable. Failures have explicit HTTP semantics; no supply-chain writes occur.

**Verification commands** (from `services/ai-service`):

```bash
uv run --locked python -m unittest discover -s tests -p 'test_*.py' -v
uv run --locked python -c 'from main import app; assert "/analysis/disruption" in app.openapi()["paths"]'
```

Use mocked calls for automated tests; verify FastAPI request/response behavior using the installed HTTP tooling. Configured key/model access remains a separate live gate in B4.

### B3 — Vehicle persistence and simulator

**Approved implementation sequence:**

1. **B3.1 — persistence foundation:** Add `demo_vehicle_state` keyed by vehicle and `demo_vehicle_shipments` for current assignments, a minimal typed PostgreSQL repository and focused isolated migration/repository tests. One vehicle can carry multiple shipments; one shipment has at most one assignment. Adapt earlier migration rollback tests so each restores the schema in `finally`.
2. **B3.2 — deterministic route playback:** Load and validate the immutable route artifact, calculate a fictional uniform position from elapsed simulated seconds, and retain its SHA-256. The progress model is demonstration data only and must never be described as recorded vehicle movement.
3. **B3.3 — explicit preparation:** Seed the fictional `SHP-002` vehicle only through a guarded demo-preparation flow. It must load the exact historical `REPLAY` warning with `source: autobahn` and provider ID `INRIX--vi-avl.2026-10-03_06-53-00-000_003.de0`; absence or newer LIVE state is an explicit failure, never a substitution.
4. **B3.4 — local demonstration API:** Add stored-state, reset and advance operations for SHP-002 only. The GET response contains stored state, route geometry and the selected historical warning; disruption relevance calculations remain B4. Unprepared state returns `409`.

**Tasks:** Persist one fictional vehicle/driver state; reject route-hash mismatches; add reset/advance/read validation and atomic revision protection. Maximum advance is 7,200 whole seconds. Advance at the destination validates `expectedRevision` and then performs a no-op. Bind local processes to loopback and guard demonstration mutations. Demo preparation must query the exact selected warning after replay and require `source: autobahn`, provider ID `INRIX--vi-avl.2026-10-03_06-53-00-000_003.de0` and `ingestionMode: REPLAY`; fail rather than use newer LIVE state.

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

**Tasks:** Prepare deterministic remaining-route, direction, timing and provenance evidence; exclude definite non-candidates without calling Python; add AI client and validated assessment API for uncertain candidates; log bounded-call outcomes. Compare retained assessment context with the current vehicle revision and warning content hash before returning a result. Perform one real NestJS → FastAPI → LLM assessment. Add a separate explicit-live evaluation script for the three cases; do not make live calls part of normal tests.

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

- [x] B1 — Route/provenance accepted.
- [x] B2 — Structured candidate explanation accepted; two non-blocking follow-ups recorded.
- [x] B3.1 — Revised vehicle-state migration and repository verified.
- [x] B3.2 — Deterministic route loading and fictional position calculation verified.
- [ ] B3.3–B3.4 — Guarded preparation and local APIs verified.
- [ ] B4 — Real backend assessment and evaluation verified.
- [ ] B5 — Frontend delivered or time-limit fallback explicitly recorded.
- [ ] B6 — Final acceptance and diff review completed.

| Checkpoint | Status | Verification results | Outstanding issues |
| ---------- | ------ | -------------------- | ------------------ |
| B1 | Complete — 2026-10-04 | `node services/api/scripts/verify-luebeck-hamburg-a1-route.js`, SHA-256, route-shape verification and `git diff --check` passed. See [route verification evidence](../research/luebeck-hamburg-a1-route-verification.md). | Passenger-car geometry and subsequent capture do not establish HGV suitability, affected carriageway or historical impact. B3 must prove exact REPLAY warning selection. |
| B2 | Accepted — 2026-10-04 | Mocked reasoning, route and schema checks passed; FastAPI OpenAPI and compilation checks passed. The live SHP-002 evaluation correctly preserved provider-delay, timing, replay, route and simulated-vehicle uncertainty. | Two non-blocking follow-ups are recorded below. NestJS current-state verification remains B4. |
| B3.1 | Complete — 2026-10-04 | Vehicle state is keyed by vehicle and `demo_vehicle_shipments` records current shipment assignments. Isolated migration/repository tests cover table rollback/reapplication, state mapping, multi-shipment assignment and one-current-assignment enforcement. `npm --prefix services/api run test:integration` passed: 8 database suites / 43 tests and 1 HTTP suite / 9 tests; the container/network were removed. API unit tests (14 suites / 53 tests), TypeScript, focused lint, build and `git diff --check` passed. | Playback, preparation and HTTP operations remain later B3 work. |
| B3.2 | Complete — 2026-10-04 | The injectable route service validates the immutable GeoJSON hash, LineString, WGS84 coordinates and provenance. Unit tests cover boundaries, Haversine distance progression, repeated coordinates, invalid elapsed seconds, deterministic results, invalid geometry and hash mismatch. Focused route tests passed (10 tests); API unit tests passed (15 suites / 63 tests); TypeScript, focused lint and build passed. | Geometry is later-captured passenger-car demonstration data, not historical vehicle tracking or HGV route evidence. |
| B3.3–B3.4 | Not started | No checkpoint tests run | Guarded preparation and local APIs |
| B4 | Not started | No real LLM assessment or evaluation run | Key/quota/model access and end-to-end integration |
| B5 | Not started; optional | No frontend checks run | 45-minute target / 60-minute maximum; retain fallback |
| B6 | Not started | No final acceptance checks run | Await required checkpoints; document incomplete work honestly |

**B2 implementation record:** The Python endpoint, compact Pydantic contract, detailed German system prompt and bounded mocked reasoning path are implemented. `DisruptionReasoningService.assess()` now explicitly prepares evidence/messages, invokes the LLM within its deadline, validates model output and evidence references, then attaches the trusted assessment ID. NestJS selects candidates and must exclude a pair when any high-confidence check is `DISTANT`, `CONFLICTING`, `BEHIND`, or timing-`CONFLICTING`; Python rejects those misrouted states. Unknown evidence remains assessable. NestJS-supplied checks include calculated geographic distance when known and explicit unknown states; Python does not receive raw geometry, coordinates, hashes or revisions.

**B2 live evaluation — 2026-10-04:** The initial live call omitted the later-captured passenger-car route limitation and was rejected by stable-ID coverage validation. A subsequent correction adds an explicit per-request list of required check and limitation IDs; every supplied limitation must be cited in `supportingEvidence`, while `missingEvidence` remains for information absent from the request. The earlier repeated call returned German output with all four checks and all four limitation IDs, described `POSSIBLE` as possible overlap, identified the route as later captured with a passenger-car profile, and preserved historical replay and simulated-vehicle uncertainty. It did not present the provider-reported 18 minutes as a confirmed or minimum shipment delay.

**B2 non-blocking follow-ups — 2026-10-04:**

1. Exclude the application-owned `assessmentId` from the LLM prompt while continuing to attach the trusted ID after output validation.
2. Add deterministic response validation requiring the LLM to cite all four supplied check IDs, alongside the existing limitation-coverage validation.

These follow-ups do not block B3. They do not change the current external API contract.
