# Iteration 003 — AI Disruption Demonstration

**Project:** LieferRadar<br>
**Status:** B1–B4 accepted; B5–B6 not started<br>
**Approval date:** 2026-10-04<br>
**Dependencies:** Iterations 001 and 002; existing NestJS and Python services<br>
**Budget:** Original six-hour allocation; approved remaining scope: 120–180 minutes including verification

Authority: [MVP scope and decision register](../product/mvp-scope.md), decisions D16–D24. See [Accelerated delivery](../product/accelerated-delivery.md) and [Database architecture](../architecture/database.md). This specification combines the essential route/simulation and AI work from the earlier Iterations B and C.

### Reduced remaining scope — approved 2026-10-05

The user approved a smaller B3.4–B6 delivery focused on disruption assessment. B1, B2 and B3.1–B3.3 remain complete; preserve their code, tests and verification records. Replace the remaining sequential playback/API work with two backend-owned manual positioning states, protect B4's deterministic evidence and real Python call, and deliver one simple operator page with an optional map.

The MVP decision register aligns D16's remaining budget, D18's named-position scope and D19's frontend/time-limit wording. Existing NestJS/Python ownership, exact REPLAY selection, revision/hash consistency and human-review safeguards remain mandatory. Iteration 003 remains an assessment demonstration: recording approval/rejection is still deferred, so delivery must not be reported as completion of the broader MVP definition.

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

The target outcome is a working backend assessment flow and one operator page for SHP-002. A map is optional: prefer a simple route/location visual or text view if mapping threatens the budget. A documented HTTP/JSON demonstration remains a transparent fallback if the page cannot be delivered; record that UI delivery is incomplete. Completing this iteration does not complete the full MVP: recording human approval/rejection remains deferred.

## Architecture

| Component | Responsibility |
| --------- | -------------- |
| NestJS `src/demo/` | Thin controller, simulation service, static route loading, deterministic evidence preparation and assessment orchestration |
| NestJS `src/demo/repository/` | Parameterized PostgreSQL access to latest fictional vehicle state through the existing `DatabaseService` |
| NestJS `src/integrations/ai/` | Bounded HTTP call to Python; versioned Zod request/response validation |
| Python `api/routes/disruption.py` | Thin asynchronous `POST /analysis/disruption` route with Pydantic request and response models |
| Python `reasoning/disruption.py` | Evidence handling, bounded structured LLM invocation and output validation |
| Python `llm/clients.py`, `prompts/disruption_assessment.py` | Reuse installed `langchain-openai`; keep client configuration and prompts at existing service boundaries |
| `services/web` (planned) | One SHP-002 operator page, named vehicle positioning and assessment output; allowlisted server forwarding to NestJS; map optional |

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

An explicit demo-preparation command reuses logistics fixture seeding, vehicle/assignment setup and recorded-warning replay against the configured local LieferRadar database. It is explicitly invoked only with `NODE_ENV=development`, and is unavailable in production, other environment modes or the isolated test context; startup performs neither migrations nor setup. The command preserves an existing demo vehicle's progress and revision on repeated runs. Historical `REPLAY` and current `LIVE` disruptions may coexist, but the reproducible scenario requires the exact selected `REPLAY` warning and fails if newer LIVE state prevents it. Automated database tests use the isolated runner and cannot fall back to development.

### Manual demonstration positioning and HTTP contracts

Use `START` and `NEAR_DISRUPTION` only. NestJS maps each name to a fixed position validated on the immutable saved route; the browser never supplies authoritative coordinates, elapsed seconds or timestamps. Reuse the existing route interpolation and persisted state without expanding playback. `START` uses elapsed seconds 0 and `2026-10-03T06:30:00.000Z`. `NEAR_DISRUPTION` is the fixed 3,840-second offset: `2026-10-03T07:34:00.000Z` at `[10.326863322601533, 53.701048700082]`. The uniform interpolation is approximately 36.40 km along the 68,242.2 m artifact distance, before the B1-measured 36.54 km warning-section start and after the `07:00Z` replay capture. This is fictional positioning, not measured GPS, an ORS ETA or a traffic model; it is not a B4 geographic candidate calculation. Preserve the two-hour shipment schedule and status.

| Endpoint | Input and result |
| -------- | ---------------- |
| `GET /demo/shipments/:id` | SHP-002 view, route/provenance, fictional vehicle/driver, latest simulation state and selected warning |
| `POST /demo/shipments/:id/vehicle-position` | `{ position: 'START' \| 'NEAR_DISRUPTION', expectedRevision }` → persisted fictional state |
| `POST /demo/shipments/:id/assessment` | `{ expectedRevision }` → deterministic evidence with exclusion or versioned structured assessment; backend selects the exact REPLAY warning |
| Python `POST /analysis/disruption` | Bounded authoritative evidence → validated assessment |

Support SHP-002 only in this demonstration. Named positioning uses an atomic `expectedRevision` check and increments revision on an accepted write; stale requests return `409` without applying. Do not add special destination or playback no-op semantics. NestJS reads shipment, exact warning and vehicle facts itself. Unprepared state or incompatible route hash returns `409`; unavailable exact REPLAY evidence fails visibly. Positioning/assessment controls require explicit local development enablement, remain disabled by default and unavailable in production, and processes bind to loopback. Existing `/shipments/:id` and `/disruptions` contracts remain unchanged. HTTP disruption filtering uses `road=A1`, mapped internally to `queriedRoad`.

### B3.4 local demonstration walkthrough

This walkthrough demonstrates the completed persisted vehicle, route and historical-warning portion of Iteration 003. B4 adds `POST /demo/shipments/SHP-002/assessment`; it returns deterministic evidence and either an exclusion or a validated AI assessment when the configured provider is available. Positioning alone remains no disruption-impact conclusion.

1. Start the local PostgreSQL service from the repository root, if it is not already running:

   ```bash
   docker compose up -d postgres
   ```

2. In `services/api`, configure the guarded local database in `.env`. The command requires exactly `NODE_ENV=development`, a local host/port and the `lieferrader_db` database name:

   ```env
   DATABASE_URL=postgresql://app:app_password_123@127.0.0.1:5432/lieferrader_db
   NODE_ENV=development
   ```

   Do not point these commands at a production or integration-test database.

3. Apply migrations and explicitly prepare the scenario. Preparation seeds the fixtures, preserves an existing approved vehicle's position/revision, replays the recorded warning and refuses a newer `LIVE` version of the selected warning:

   ```bash
   npm run migrate:up:local
   npm run prepare:ai-disruption-demo
   ```

   Successful preparation prints `VEH-DEMO-002`, the selected Autobahn provider ID and `"warningIngestionMode":"REPLAY"`. If it reports newer `LIVE` state, stop: that protection intentionally prevents historical replay from being presented as current evidence.

4. Start the API with the mutation control explicitly enabled. It listens on loopback:

   ```bash
   NODE_ENV=development LIEFERRADAR_DEMO_CONTROLS_ENABLED=true npm run start:dev
   ```

5. In a second terminal, read the prepared scenario:

   ```bash
   curl --fail-with-body http://127.0.0.1:3000/demo/shipments/SHP-002
   ```

   Verify `shipment.status` remains `PLANNED`; `vehicle.revision` is present; the route has its SHA-256/provenance; and `warning.source`, `warning.providerId` and `warning.ingestionMode` are respectively `autobahn`, `INRIX--vi-avl.2026-10-03_06-53-00-000_003.de0` and `REPLAY`.

6. Copy the returned `vehicle.revision` and use it as `expectedRevision` to choose the fixed near-disruption state. For a freshly prepared vehicle that revision is normally `0`:

   ```bash
   curl --fail-with-body \
     -X POST http://127.0.0.1:3000/demo/shipments/SHP-002/vehicle-position \
     -H 'content-type: application/json' \
     -d '{"position":"NEAR_DISRUPTION","expectedRevision":0}'
   ```

   The accepted response has `elapsedSeconds: 3840`, `simulatedAt: "2026-10-03T07:34:00.000Z"` and an incremented revision. Use the returned revision for every following mutation.

7. Re-read the GET endpoint to confirm the latest position persists. Submit the old revision again to observe the expected `409 Conflict`; it must not change the stored state:

   ```bash
   curl -i \
     -X POST http://127.0.0.1:3000/demo/shipments/SHP-002/vehicle-position \
     -H 'content-type: application/json' \
     -d '{"position":"START","expectedRevision":0}'
   ```

8. To rerun the positioning demonstration, first GET the scenario and use its current revision to select `START`:

   ```bash
   curl --fail-with-body \
     -X POST http://127.0.0.1:3000/demo/shipments/SHP-002/vehicle-position \
     -H 'content-type: application/json' \
     -d '{"position":"START","expectedRevision":<current-revision>}'
   ```

   `START` restores the initial route coordinate and `2026-10-03T06:30:00.000Z`, then increments revision. It does not reset the revision counter. Stop and restart the API, then GET the scenario again to confirm that this latest state remains persisted.

9. Stop the API and restart it without `LIEFERRADAR_DEMO_CONTROLS_ENABLED=true`; the position POST returns `404`. `NODE_ENV=production` also returns `404` even if that flag is supplied. The GET endpoint remains read-only.

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

Commands below are planned acceptance commands for remaining work; completed checkpoint evidence is retained separately. Existing database/HTTP checks must run through `test:integration`, never direct database-backed Jest execution against development. Time spent testing and documenting belongs within each checkpoint budget; B6 is the final consolidated review.

| Checkpoint | Budget | Dependencies | Deliverable |
| ---------- | ------ | ------------ | ----------- |
| B1 | 30 min | Existing route and warning fixtures | Verified artifact/provenance and documented limitations |
| B2 | 60 min | B1 evidence and version 1 contract | Python structured reasoning and mocked evaluation |
| B3 | 90 min | B1 route; existing database infrastructure | Latest vehicle persistence, explicit setup, simulation APIs |
| B4 | 90 min | B2 and B3 | NestJS evidence, Python HTTP integration, real backend flow |
| B5 | 45 min target; 60 min hard maximum | B3/B4 APIs | Optional Next.js map and assessment controls |
| B6 | 30 min | B1–B4; B5 delivered or time-limit fallback | Final regression/evaluation record and walkthrough |

The table above records the original allocation. The approved remaining sequence supersedes its remaining B3/B4/B5/B6 budgets:

| Remaining checkpoint | Estimate including focused verification | Deliverable |
| -------------------- | --------------------------------------- | ----------- |
| B3.4 | 25–35 min | Stored SHP-002 view and revision-protected START/NEAR_DISRUPTION positioning |
| B4 | 60–85 min | All four deterministic checks, exclusion bypass, validated Python client/API and one real end-to-end assessment |
| B5 | 20–30 min | One operator page; optional map only within this allowance |
| B6 | 15–30 min | Consolidated regression evidence, persisted restart and operator walkthrough |

Total: 120–180 minutes. Protect B4 and the final correctness gates; cut map work first. Credential/quota failures or unexpected integration defects may exceed the estimate and must be reported rather than bypassed.

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
4. **B3.4 — manual demonstration positioning:** Add stored-state GET and one named-position mutation for SHP-002 only. Reuse the existing row, assignment and validated route; no migration is planned. GET includes shipment summary, vehicle state/revision, route geometry/provenance and the exact historical REPLAY warning. Define and verify START/NEAR_DISRUPTION mappings. Disruption relevance calculations remain B4. Unprepared state returns `409`.

**Remaining tasks:** Add a thin controller, validated enum/revision DTO and minimal service/repository update. Persist position, elapsed offset, consistent historical timestamp and incremented revision atomically. Reject route-hash mismatches, invalid states, arbitrary coordinate input and stale writes. Bind local processes to loopback and guard mutations. Preserve B3.3 preparation and its exact REPLAY identity requirement; do not invoke setup at startup or reset existing progress through preparation.

**Acceptance:** Each named state deterministically yields a validated saved-route position and timestamp; accepted state persists after restart. Stale revision writes fail without mutation. Preparation preserves previously stored state. SHP-001/SHP-002 contracts and shipment status remain unchanged. Explicit setup targets only the configured eligible local database. Focused unit/isolated HTTP tests cover valid/invalid named inputs, unsupported shipment, route mismatch, unprepared state, persistence, stale writes and disabled/production guards.

**Verification commands** (repository root):

```bash
npm --prefix services/api run test -- --runInBand
npm --prefix services/api run test:integration
npm --prefix services/api run build
git diff --check
```

Also run `npx tsc --noEmit --incremental false` and focused `npx eslint "src/demo/**/*.ts"` from `services/api`. Document explicit local migration/preparation commands and named-position requests. Database/HTTP tests must use the isolated runner.

### B4 — Complete backend assessment

**Tasks:** After NEAR_DISRUPTION positioning, read authoritative shipment, vehicle and exact REPLAY warning facts. Prepare geographic proximity to the remaining route, ahead/behind section position, explicit direction compatibility, timing compatibility and provenance/limitations using the existing version 1 contract. Keep the experimental 25 m warning-to-route tolerance; a vehicle-to-warning distance alone is never a candidate rule. Definite exclusions skip Python; uncertain evidence remains eligible. Add a bounded validated HTTP client and minimal assessment endpoint that returns deterministic evidence alongside either an exclusion or an AI result. Compare retained vehicle revision and warning content hash with current state before returning. Log bounded-call outcomes without contact information/secrets. Perform one real NestJS → FastAPI → LLM assessment; retain automated mocked negative controls. Broader multi-case live evaluation is deferred; existing Python evaluation tooling may support diagnosis without becoming another required feature.

**Acceptance:** The SHP-002 historical scenario yields a validated result with source-backed evidence and uncertainty. Opposite-direction, behind-vehicle and conflicting-timing controls are excluded; insufficient data stays explicit. Database and Python errors propagate appropriately. New vehicle context can receive a new assessment without a warning-content change.

**Verification commands:** Repeat API unit, isolated integration/HTTP, TypeScript and focused lint checks from B3; repeat B2 Python tests. For the explicit local smoke check (only after enabling demo controls and preparing the configured local database):

```bash
curl --fail-with-body http://127.0.0.1:3000/demo/shipments/SHP-002
```

Use its current revision in documented vehicle-position (`NEAR_DISRUPTION`) and assessment requests. The backend selects the exact historical warning. Execute one real assessment through NestJS and FastAPI, not solely a direct Python call. Automated checks cover distant geometry, opposite direction, wholly behind vehicle, conflicting timing, incomplete evidence, timeout/invalid AI output and changes to vehicle revision or warning content during assessment.

Record actual model, timing and case outcomes. A valid schema alone is not evidence of factual correctness. Invalid credentials/quota/model access blocks the real-AI acceptance gate; a mocked result is not an equivalent success.

### B5 — One operator page; optional map

**Tasks:** One SHP-002 operator page showing shipment summary, fictional vehicle/location, saved route, exact historical warning, START/NEAR_DISRUPTION controls and assessment action. Display AI operator message, deterministic checks, missing evidence/uncertainty and recommended actions requiring human review, with clear simulation/REPLAY provenance. Keep server-only backend configuration and allowlisted forwarding. Use a simple visual/text route representation first; add React Leaflet/OSM only if achievable within 20–30 minutes, with attribution and tile-failure tolerance. No dashboard/general shipment management.

**Acceptance:** A reviewer places the vehicle near the disruption and requests/displays a validated assessment with honest loading/error/exclusion/provenance states. Bind web to loopback. Stop map work when it threatens the allowance and complete the simple page; if the page remains incomplete, document the HTTP/JSON fallback and incomplete UI condition. A stale revision prompts refresh; vehicle changes clear the displayed assessment. No operational action is executed.

**Verification commands** (planned web scripts, repository root):

```bash
npm --prefix services/web run typecheck
npm --prefix services/web run lint
npm --prefix services/web run build
```

Manually verify START/NEAR_DISRUPTION positioning, assessment, exclusion/error display and provenance. Avoid introducing a browser-test framework for this time-limited page.

### B6 — Final acceptance and review

**Tasks:** Prove saved route → persisted fictional vehicle → exact historical REPLAY warning → deterministic NestJS evidence → real Python AI call → validated operator result → simple page if delivered. Demonstrate persisted state after restart and review input/output validation, local guards and focused diff. Record actual model/duration, provenance limitations, failures and UI disposition. Reuse unchanged checkpoint verification results from the current implementation session; rerun consolidated checks once when needed, not a new broad evaluation project.

**Verification commands:** API unit, isolated integration/HTTP and build commands from B3; Python tests/import check from B2; web checks from B5 if delivered. From `services/api`, run:

```bash
npx tsc --noEmit --incremental false
npx eslint "{src,apps,libs,test}/**/*.ts"
```

From the repository root, run `git diff --check` and review `git diff` plus new files. Keep lint non-mutating; distinguish the previously reported unused `metadata` finding from new regressions. Run `test:integration:cleanup` only if the runner/teardown changes. Verify disabled/production mutation 404 behavior and existing shipment HTTP regressions within the isolated suite.

**Acceptance:** The exact historical scenario is demonstrated through the API and operator page if delivered, including persisted restart and real AI result. Original warning content and shipment APIs remain intact. Every required check has an actual result; blocked checks are not passes. LIVE ingestion/current disruption APIs remain independently demonstrable and are not an AI-flow dependency. Stop for review; no commit/push or later checkpoint authorization is implied.

## Constraints and deferrals

**Newly deferred from remaining mandatory delivery:** sequential advance-by-seconds/reset APIs and controls; repeated full-route progression; destination no-op product behavior; timers/background movement; realistic GPS, speed/heading and tracking behavior; position/assignment history and fleet features; required interactive map/layers; multi-case real-LLM evaluation expansion. Existing B3.1/B3.2 persistence, interpolation and tests stay intact. One real end-to-end AI assessment, all four deterministic checks and automated exclusion/uncertainty controls remain required.

- Operate on loopback with one configured eligible local LieferRadar database. Demo preparation and replay are explicit, guard local/development configuration and remain unavailable in production. Credentials stay server-side.
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
- [x] B3.3 — Guarded demo preparation verified.
- [x] B3.4 — Manual demonstration positioning verified.
- [x] B4 — Complete backend assessment accepted.
- [ ] B5 — Frontend delivered or time-limit fallback explicitly recorded.
- [ ] B6 — Final acceptance and diff review completed.

| Checkpoint | Status | Verification results | Outstanding issues |
| ---------- | ------ | -------------------- | ------------------ |
| B1 | Complete — 2026-10-04 | `node services/api/scripts/verify-luebeck-hamburg-a1-route.js`, SHA-256, route-shape verification and `git diff --check` passed. See [route verification evidence](../research/luebeck-hamburg-a1-route-verification.md). | Passenger-car geometry and subsequent capture do not establish HGV suitability, affected carriageway or historical impact. B3 must prove exact REPLAY warning selection. |
| B2 | Accepted — 2026-10-04 | Mocked reasoning, route and schema checks passed; FastAPI OpenAPI and compilation checks passed. The live SHP-002 evaluation correctly preserved provider-delay, timing, replay, route and simulated-vehicle uncertainty. | Two non-blocking follow-ups are recorded below. NestJS current-state verification remains B4. |
| B3.1 | Complete — 2026-10-04 | Vehicle state is keyed by vehicle and `demo_vehicle_shipments` records current shipment assignments. Isolated migration/repository tests cover table rollback/reapplication, state mapping, multi-shipment assignment and one-current-assignment enforcement. `npm --prefix services/api run test:integration` passed: 8 database suites / 43 tests and 1 HTTP suite / 9 tests; the container/network were removed. API unit tests (14 suites / 53 tests), TypeScript, focused lint, build and `git diff --check` passed. | Playback, preparation and HTTP operations remain later B3 work. |
| B3.2 | Complete — 2026-10-04 | The injectable route service validates the immutable GeoJSON hash, LineString, WGS84 coordinates and provenance. Unit tests cover boundaries, Haversine distance progression, repeated coordinates, invalid elapsed seconds, deterministic results, invalid geometry and hash mismatch. Focused route tests passed (10 tests); API unit tests passed (15 suites / 63 tests); TypeScript, focused lint and build passed. | Geometry is later-captured passenger-car demonstration data, not historical vehicle tracking or HGV route evidence. |
| B3.3 | Complete — 2026-10-05 | Corrected architecture: `prepare:ai-disruption-demo` uses the configured local `DATABASE_URL`, never a second demo URL/database. It remains explicit (`--demo`), local/development-only and unavailable in production or the integration-test context. It seeds logistics fixtures, preserves any existing approved vehicle progress/revision, replays the recorded A1 fixture, then queries `autobahn` / `INRIX--vi-avl.2026-10-03_06-53-00-000_003.de0` and requires `REPLAY`; newer LIVE state is a visible failure. Focused guard/preparation tests passed (10 tests); full API unit tests passed (17 suites / 73 tests); isolated integration and HTTP verification passed (9 database suites / 44 tests; 1 HTTP suite / 9 tests) and removed its container/network. TypeScript, focused lint, build and `git diff --check` passed. Checkpoint-review correction: the shared guard now requires `NODE_ENV=development` and rejects `test`, `production`, unset and other environment modes; 15 focused guard/preparation tests, TypeScript, focused lint and `git diff --check` passed. | Run local migrations before preparation. B3.4 local read/reset/advance APIs remain unstarted. |
| B3.4 | Complete — 2026-10-05 | `GET /demo/shipments/SHP-002` returns the prepared shipment, fictional vehicle/driver, state/revision, immutable route/provenance and only the exact `autobahn` / `INRIX--vi-avl.2026-10-03_06-53-00-000_003.de0` `REPLAY` warning. `POST /demo/shipments/SHP-002/vehicle-position` accepts only `START` or `NEAR_DISRUPTION` plus `expectedRevision`; its SQL update is atomic and a stale revision returns `409`. `NEAR_DISRUPTION` is the fixed 3,840-second mapping: `2026-10-03T07:34:00.000Z`, `[10.326863322601533, 53.701048700082]`, and approximately 36.40 km by the 68,242.2 m artifact distance—before B1's documented 36.54 km warning-section start. This is a validated display position, not a B4 candidate rule. Mutations require `NODE_ENV=development` and `LIEFERRADAR_DEMO_CONTROLS_ENABLED=true`; startup now binds loopback. Unit verification passed: 18 suites / 83 tests. Isolated verification passed: 9 database suites / 45 tests and 2 HTTP suites / 15 tests; its container/network were removed. TypeScript, focused demo lint, build and `git diff --check` passed. | B4 deterministic evidence and assessment endpoint remain unstarted; no sequential playback, relevance calculation, Python call or frontend work was added. |
| B4 | Complete — 2026-10-05 | NestJS prepares the version-1 evidence for the exact selected `REPLAY` warning using the 25 m warning-geometry-to-remaining-route tolerance, returns definite exclusions without Python, and otherwise calls FastAPI through a 30-second, no-retry native-fetch client with Zod validation. Assessment input is strict (`expectedRevision` only); the trusted assessment ID, disruption ID, all four check IDs, every limitation ID and human-review actions are required before returning. Vehicle revision, assignment, warning identity/content hash and REPLAY provenance are reread before return. Python excludes the application-owned ID from LLM evidence and emits one safe attempt log with assessment ID, configured model, duration, outcome and bounded failure metadata. Initial real diagnosis found FastAPI returned 200 but the LLM omitted the disruption evidence ID; NestJS correctly rejected it. Python prompt/output validation now require that ID too. Current correction checks passed: 18 Python tests, OpenAPI import with `DEBUG=false`, and `git diff --check`. Earlier B4 API unit (21 suites / 92 tests), isolated DB/HTTP (9 suites / 45 tests; 2 suites / 16 tests), TypeScript, focused lint and build remain passing. Real NestJS → FastAPI → `gpt-4o-mini` smoke then succeeded: Python duration 4,950 ms; outer HTTP duration 5.021 s; outcome `success`; checks `NEAR_REMAINING_ROUTE`, `COMPATIBLE`, `AHEAD_OR_ALONGSIDE`, `POSSIBLE`. The validated English result cited the disruption, all four checks and all five limitations, contained missing-end-time uncertainty and human-review actions, did not invent a numeric shipment delay/ETA, and retained assessment ID `db6513e4-fdfd-4d6a-81d0-a708e690c2da`. Current state after return remained revision 6 with the exact selected REPLAY warning. | Local AI-service startup still requires a boolean `DEBUG` value; the committed code is unaffected. B5 remains unstarted. |
| B5 | Proposed reduced plan; not started | No frontend checks run | One operator page, 20–30 min; map optional; align D19 |
| B6 | Not started | No final acceptance checks run | Await required checkpoints; document incomplete work honestly |

**B2 implementation record:** The Python endpoint, compact Pydantic contract, detailed German system prompt and bounded mocked reasoning path are implemented. `DisruptionReasoningService.assess()` now explicitly prepares evidence/messages, invokes the LLM within its deadline, validates model output and evidence references, then attaches the trusted assessment ID. NestJS selects candidates and must exclude a pair when any high-confidence check is `DISTANT`, `CONFLICTING`, `BEHIND`, or timing-`CONFLICTING`; Python rejects those misrouted states. Unknown evidence remains assessable. NestJS-supplied checks include calculated geographic distance when known and explicit unknown states; Python does not receive raw geometry, coordinates, hashes or revisions.

**B2 live evaluation — 2026-10-04:** The initial live call omitted the later-captured passenger-car route limitation and was rejected by stable-ID coverage validation. A subsequent correction adds an explicit per-request list of required check and limitation IDs; every supplied limitation must be cited in `supportingEvidence`, while `missingEvidence` remains for information absent from the request. The earlier repeated call returned German output with all four checks and all four limitation IDs, described `POSSIBLE` as possible overlap, identified the route as later captured with a passenger-car profile, and preserved historical replay and simulated-vehicle uncertainty. It did not present the provider-reported 18 minutes as a confirmed or minimum shipment delay.

**B2 follow-ups completed during B4 — 2026-10-05:**

1. Exclude the application-owned `assessmentId` from the LLM prompt while continuing to attach the trusted ID after output validation.
2. Add deterministic response validation requiring the LLM to cite all four supplied check IDs, alongside the existing limitation-coverage validation.

These changes preserve the current external API contract.
