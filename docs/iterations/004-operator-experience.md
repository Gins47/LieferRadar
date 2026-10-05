# Iteration 004 — Operator Experience

## Status

PLANNED

## Goal

Turn the existing LieferRadar disruption demonstration into a small,
operator-facing product experience using actual persisted application data.

Iteration 003 established the technical foundation:

- persisted shipments;
- fictional demo vehicle assignment/state;
- immutable SHP-002 route;
- historical Autobahn REPLAY evidence;
- LIVE disruption ingestion/persistence;
- deterministic disruption evidence;
- revision-protected demo positioning;
- NestJS → FastAPI AI assessment;
- structured evidence-constrained AI results;
- Next.js operator UI.

Iteration 004 does not redesign those capabilities.

It adds a clearer operator workflow around them:

1. Operations dashboard
2. Live Warnings
3. Shipment detail with compact deterministic evidence and AI assessment

Developer simulation remains API-driven rather than exposed as operator UI
controls.

---

## Product Story

LieferRadar should help an operator answer:

> Which shipments may require my attention, what real disruption information
> is available, and what should I review next?

The operator should not need to inspect every shipment manually.

NestJS determines authoritative operational state and disruption evidence.

The UI presents those results.

AI is used only after deterministic evidence has established the relevant
operational context.

---

## Demo Workflow

The reproducible SHP-002 scenario remains the primary demonstration.

### 1. Prepare scenario

Use the existing guarded demo preparation flow.

The prepared scenario contains:

- shipment `SHP-002`;
- Lübeck → Hamburg route;
- vehicle `VEH-DEMO-002`;
- immutable validated route fixture;
- exact historical Autobahn REPLAY warning;
- persisted vehicle state/revision.

### 2. Simulate departure

Through the existing guarded API, set:

`SHP-002 → START`

Simulation is performed through the API, not through the operator UI.

At START, the vehicle's simulated time is before the historical warning was
observed.

The dashboard therefore does not place SHP-002 under `Needs attention`.

The shipment must not be described as safe or unaffected.

Instead the backend exposes an explicit state/reason equivalent to:

> Historical warning not yet observed at simulated time.

### 3. Simulate journey progression

Through the same guarded API, set:

`SHP-002 → NEAR_DISRUPTION`

The backend-owned state determines the validated route position and simulated
time.

No sequential GPS simulation is required.

### 4. Refresh Operations

After the warning has become observable in simulated time, NestJS evaluates
the existing deterministic evidence.

For the accepted SHP-002 scenario:

- geographic: `NEAR_REMAINING_ROUTE`
- direction: `COMPATIBLE`
- route position: `AHEAD_OR_ALONGSIDE`
- timing: `POSSIBLE`

The dashboard now surfaces:

> Potential disruption — needs review.

SHP-002 appears under `Needs attention`.

### 5. Review shipment

The operator opens SHP-002.

The shipment detail displays:

- shipment;
- vehicle;
- route presentation;
- historical disruption;
- deterministic evidence;
- provenance/limitations.

### 6. Analyze with AI

The operator explicitly selects:

`Analyze with AI`

The existing assessment flow remains:

`NestJS deterministic evidence → FastAPI → LLM → structured validated response → operator presentation`

The result emphasizes:

- operator message;
- uncertainty;
- recommended human-review actions;
- human-review-required status.

Detailed evidence remains accessible but visually secondary.

---

## Architecture Boundaries

The existing service boundary remains:

`Browser → Next.js → NestJS → FastAPI only for explicit AI analysis`

### NestJS owns

- logistics truth;
- shipment persistence;
- vehicle assignment/state;
- disruption persistence;
- LIVE/REPLAY provenance;
- route/evidence calculations;
- geographic relationship;
- direction compatibility;
- route position;
- timing relationship;
- disruption eligibility;
- operator/dashboard read models.

### Next.js owns

Presentation and operator interaction only.

The frontend must not independently calculate:

- geographic proximity;
- route position;
- direction compatibility;
- timing compatibility;
- disruption eligibility;
- shipment impact.

### FastAPI owns

Evidence-constrained AI reasoning only.

FastAPI does not own:

- shipment state;
- disruption persistence;
- geographic matching;
- vehicle simulation;
- operational mutations.

---

## Historical Attention Semantics

### Important constraint

`START` is NOT a deterministic exclusion.

The existing Iteration 003/B4 deterministic evidence and AI eligibility rules
remain unchanged.

The existing evidence evaluation considers the remaining journey. Against the
recorded fixture, both START and NEAR_DISRUPTION can produce:

- `NEAR_REMAINING_ROUTE`
- `COMPATIBLE`
- `AHEAD_OR_ALONGSIDE`
- `POSSIBLE`

Iteration 004 must not change these facts merely to produce a dashboard
transition.

### Warning observability

For the historical SHP-002 operator scenario, NestJS additionally determines
whether the exact REPLAY warning was observable at the vehicle's simulated
time.

This is an operator/read-model presentation rule.

#### Before warning observation

If:

`simulated vehicle time < historical warning observation/capture time`

then:

- shipment is not counted under `Needs attention`;
- warning is considered not yet observable in the simulated scenario;
- backend returns an explicit reason;
- shipment is not described as unaffected;
- existing B4 deterministic semantics remain unchanged.

#### After warning observation

If the warning is observable, use the existing deterministic evidence.

The accepted positive scenario becomes:

`Potential disruption — needs review`

when the existing evidence supports that result.

### Unknown evidence

Unknown or incomplete evidence must remain explicit.

Do not transform incomplete evidence into:

- a positive match;
- a definitive exclusion;
- a safe/unaffected state.

---

## LIVE vs REPLAY

The distinction between LIVE and REPLAY remains explicit.

### REPLAY

The SHP-002 AI demonstration uses the exact historical Autobahn warning with:

`ingestionMode = REPLAY`

This provides a reproducible AI scenario.

REPLAY evidence must remain clearly labelled historical/replayed.

### LIVE

The Live Warnings view uses only:

`ingestionMode = LIVE`

LIVE warnings provide current operational road context.

A LIVE warning must never silently substitute for the exact historical
SHP-002 REPLAY warning.

This allows the product to demonstrate both:

- real current Autobahn data ingestion;
- reproducible historical AI assessment.

---

## Live Warnings Semantics

The product definition is:

> Persisted LIVE Autobahn warnings observed today on roads used by saved
> LieferRadar shipments.

This is intentionally narrower than:

> All warnings in Germany.

It is also intentionally weaker than:

> Warnings definitely affecting a shipment.

Road association provides useful operational context but does not prove
route-segment or shipment impact.

### Current day

"Today" uses the `Europe/Berlin` calendar day.

Filtering should use the existing authoritative LIVE observation timestamp,
preferably `lastLiveSeenAt` where that is the intended persisted field.

A warning may have started earlier but still appear if it was observed today.

### Freshness

Observed today does not necessarily mean the provider warning is guaranteed to
still be active now.

The UI should therefore expose observation freshness rather than inventing
stronger lifecycle guarantees.

Existing authoritative lifecycle/status information may be reused where
naturally supported, but Iteration 004 must not introduce a new warning
lifecycle system.

---

# B1 — Operator Read Models

## Goal

Add the minimum NestJS read models required by the new operator UI.

No frontend work belongs in this checkpoint.

## Operations read model

Preferred conceptual endpoint:

`GET /operations/shipments`

The exact DTO/API structure may follow existing repository conventions.

Use actual persisted data.

Expose enough authoritative information for the frontend to render:

- total shipment count;
- needs-attention count;
- relevant LIVE-warning count;
- shipments requiring attention;
- other shipments.

Where applicable distinguish states equivalent to:

- `NEEDS_REVIEW`
- `WARNING_NOT_YET_OBSERVED`
- `NOT_EVALUATED`
- `INCOMPLETE_EVIDENCE`
- `EXCLUDED`
- `SCENARIO_UNAVAILABLE`

Naming should follow existing project conventions.

## Current assessment limitation

Only SHP-002 currently has the accepted complete:

- route;
- vehicle;
- historical warning;
- deterministic evidence;
- AI assessment

context.

Do not generalize disruption matching across every persisted shipment merely
to populate the dashboard.

For example, SHP-001 must not be described as unaffected if it has not
actually been evaluated.

## Live Warnings read model

Preferred conceptual endpoint:

`GET /operations/warnings?page=1&limit=20`

Return persisted LIVE Autobahn warnings:

- observed today;
- on roads represented by saved shipments;
- bounded by pagination.

Return the full matching count independently of page size.

Where actually available in the normalized model, expose useful fields such
as:

- road;
- provider title/description;
- direction;
- provider/warning timestamp;
- last observation timestamp;
- source;
- ingestion mode.

Do not:

- return REPLAY records;
- invent severity;
- infer shipment impact;
- invoke AI;
- claim road association proves route-segment impact.

## SHP-002 detail read

Extend the existing SHP-002 scenario/detail response only as necessary for the
frontend to display deterministic evidence before AI analysis.

Reuse existing accepted evidence logic.

Expose:

- four deterministic evidence states;
- operator/dashboard review state;
- review-state reason.

The existing assessment POST contract remains unchanged.

## Read-only guarantee

Operations reads must never:

- call FastAPI;
- call an LLM;
- trigger ingestion;
- prepare/reset demo state;
- mutate vehicle state.

## Persistence

Reuse existing persistence and repository abstractions.

Focused repository read methods may be added where required.

No database migration is expected.

If B1 requires substantial new persistence architecture, stop and reconsider
scope.

## B1 Acceptance Criteria

- START before historical warning observation is not counted under Needs
  Attention.
- START receives an explicit warning-not-yet-observed state/reason.
- START is not converted into a deterministic exclusion.
- NEAR_DISRUPTION after warning observation and with accepted positive
  evidence is Needs Attention.
- Existing deterministic exclusions remain unchanged.
- Unknown/incomplete evidence remains explicit.
- Exact REPLAY provenance remains required for the historical scenario.
- LIVE evidence cannot substitute for the historical warning.
- Persisted shipment counts are authoritative.
- Unevaluated shipments are not falsely described as unaffected.
- Live Warnings returns LIVE only.
- REPLAY is excluded.
- Warning filtering uses Europe/Berlin current-day semantics.
- Shipment-road filtering is backend-owned.
- Pagination returns page results and total matching count.
- Read endpoints do not invoke AI or mutate state.

---

# B2 — Operations Dashboard + Live Warnings

## Goal

Replace the technical-demo-first entry experience with a small operations
dashboard backed by B1 read models.

UI implementation should use:

`docs/iterations/004-operator-experience-wireframes.md`

as the presentation reference.

The wireframe is a layout/product reference, not a pixel-perfect
specification.

## Navigation

Keep navigation minimal:

`Operations | Live Warnings`

Routes:

- `/` → Operations
- `/warnings` → Live Warnings
- `/shipments/:id` → Shipment detail

No sidebar is required.

## Operations

The dashboard should show actual backend-provided data.

### Summary

Display:

- Shipments
- Needs attention
- Relevant LIVE warnings

Do not invent:

- risk scores;
- AI confidence percentages;
- delivery performance;
- fleet utilization;
- fake operational metrics.

### Needs Attention

Display shipments for which NestJS provides the corresponding authoritative
operator state.

A card may show:

- shipment ID;
- origin → destination;
- shipment status;
- vehicle where available;
- relevant disruption summary;
- operator attention state;
- Review shipment action.

### Other Shipments

Display remaining persisted shipments with their actual backend state.

Examples include:

- warning not yet observed;
- not evaluated;
- incomplete evidence;
- scenario unavailable.

Do not label these shipments "safe" unless the backend has actually
established that fact.

## Live Warnings

Route:

`/warnings`

Display:

> LIVE Autobahn warnings observed today on shipment roads.

Use B1 data only.

Warnings should expose actual normalized/provider information and observation
freshness.

Provide an honest empty state when no relevant LIVE warning was observed
today.

Never fill an empty LIVE view using REPLAY data.

## Frontend constraints

Continue using:

- Next.js;
- TypeScript;
- Tailwind;
- existing shadcn/ui foundation;
- native fetch;
- simple React state;
- existing same-origin proxy pattern.

Do not introduce another frontend state/data library.

## B2 Acceptance Criteria

- `/` renders actual persisted shipment/read-model data.
- summary counts come from NestJS.
- Needs Attention is backend-authoritative.
- refresh reflects changed backend/demo state.
- `/warnings` contains LIVE only.
- historical REPLAY data is never presented as LIVE.
- observation freshness is visible.
- empty and error states are handled.
- browser communicates with NestJS through the existing Next.js boundary.
- frontend performs no geographic/evidence calculations.

---

# B3 — Shipment Detail + Compact AI Assessment

## Goal

Turn the existing B5 technical demo page into a focused operator shipment
detail.

Route:

`/shipments/SHP-002`

Reuse existing B5 functionality rather than rebuilding it.

Use:

`docs/iterations/004-operator-experience-wireframes.md`

as the presentation reference.

## Remove simulation controls

Remove operator-facing controls for:

- `Set START`
- `Set NEAR_DISRUPTION`

Vehicle simulation remains available through the existing guarded API for
developer/interview demonstration.

No sequential movement UI is required.

## Shipment information

Retain:

- shipment ID;
- Lübeck → Hamburg;
- pickup/planned delivery;
- vehicle;
- route presentation;
- historical warning;
- REPLAY provenance;
- relevant limitations.

## Deterministic evidence

Show the four NestJS-provided evidence dimensions compactly:

- geographic;
- direction;
- route position;
- timing.

The frontend renders these values.

It must not recompute them.

## AI interaction

Retain:

`Analyze with AI`

This remains an explicit operator action.

Use the current revision and existing assessment endpoint.

Do not automatically invoke AI when:

- dashboard loads;
- shipment detail loads;
- vehicle position changes.

## Compact assessment

The primary AI presentation should emphasize:

1. operator message;
2. uncertainty;
3. recommended human-review actions;
4. explicit human-review-required status.

Existing recommended action types remain constrained by the backend contract,
including:

- `MONITOR`
- `VERIFY_INFORMATION`
- `REVIEW_PLAN`

## Secondary evidence

Keep the full structured response available through a secondary/expandable
section.

A native `<details>` element is sufficient.

Include existing fields such as:

- supporting evidence;
- missing evidence;
- limitations;
- possible consequences;
- assessment ID.

Do not discard evidence simply to make the UI shorter.

Do not generate a second frontend summary of the LLM result.

The existing operator message remains authoritative.

## B3 Acceptance Criteria

- no START/NEAR simulation controls appear in the operator UI;
- developer simulation remains possible through the guarded API;
- deterministic evidence is visible before AI analysis;
- Analyze with AI uses the existing assessment flow;
- current revision protection remains intact;
- operator message remains unchanged;
- uncertainty is visible;
- human-review requirement is visible;
- recommended actions remain visible;
- all detailed evidence remains accessible;
- stale revision behavior remains explicit;
- no frontend-generated conclusions are introduced.

---

# Verification Strategy

Keep verification proportional to each checkpoint.

During implementation:

1. run focused tests for changed behavior;
2. fix checkpoint-specific failures;
3. run relevant lint/type/build checks;
4. run broad required verification once at the checkpoint boundary.

Avoid repeatedly running the full repository test suite while developing.

Each checkpoint should receive a focused checkpoint review before proceeding.

---

# Explicit Non-Goals

Iteration 004 does NOT include:

- periodic LIVE-warning ingestion worker;
- Leaflet;
- interactive maps;
- charts;
- analytics dashboard;
- shipment creation;
- shipment creation UI;
- fleet management;
- vehicle position history;
- assignment history;
- polling;
- WebSockets;
- background vehicle movement;
- realistic GPS simulation;
- automatic AI assessment;
- automatic operational actions;
- assessment persistence;
- generalized LIVE disruption assessment for every shipment;
- Langfuse;
- AI evaluation framework.

Langfuse observability and focused AI evals belong to a separate follow-up
AI-quality iteration.

---

# Implementation Checkpoints

- [x] B1 — Operator read models
- [ ] B1 checkpoint review
- [x] B2 — Operations Dashboard + Live Warnings
- [ ] B2 checkpoint review
- [x] B3 — Shipment detail + compact AI assessment
- [ ] B3 checkpoint review
- [ ] Iteration 004 final verification

## B1 implementation record — 2026-10-05

Implemented read-only `GET /operations/shipments` and paginated
`GET /operations/warnings`. Shipment reads use persisted shipment data and
keep SHP-001 explicitly `NOT_EVALUATED`. SHP-002 reuses the accepted demo
scenario and deterministic evidence: before the recorded warning observation
it is `WARNING_NOT_YET_OBSERVED`; an observable positive evidence tuple is
`NEEDS_REVIEW`; exclusions and incomplete evidence remain explicit. The
existing SHP-002 scenario response now exposes the same review state, reason
and four deterministic checks without invoking assessment.

LIVE-warning reads are restricted to active persisted Autobahn `LIVE` warning
records whose `lastLiveSeenAt` falls on the current Europe/Berlin calendar day
and whose road is represented by a saved shipment. REPLAY records are not
eligible. Pagination retains an independent matching total. No migration,
ingestion, mutation, FastAPI or LLM call was added.

Focused verification passed: 4 Jest suites / 16 tests; TypeScript
`--noEmit`; API build; and lint for the touched API surface. `git diff --check`
passed.

## B2 implementation record — 2026-10-05

Implemented the read-only Operations dashboard at `/` and Live Warnings at
`/warnings`, with minimal top-level navigation. Both browser pages use
same-origin Next.js proxy routes to consume the B1 Operations endpoints. The
dashboard renders only NestJS-provided counts and review states: START remains
outside Needs Attention with its warning-not-yet-observed reason; a refreshed
NEAR_DISRUPTION scenario appears under Needs Attention. Unevaluated shipments
are not described as safe or unaffected.

Live Warnings renders only the B1-provided LIVE warning fields, makes last
observation time visible, supplies an honest empty/error state, and uses
simple Previous/Next controls when pagination needs them. The accepted B5
SHP-002 detail page remains available at `/shipments/SHP-002`, including its
existing controls and assessment behavior; B3 redesign remains deferred.

Focused verification passed: web typecheck, lint, production build and
`git diff --check`.

## B3 implementation record — 2026-10-05

Refined `/shipments/SHP-002` into an operator review page while preserving the
existing backend assessment contract. Removed all operator-facing START and
NEAR_DISRUPTION controls; interview/demo state remains controlled through the
guarded API. The page renders the backend-provided review state and reason,
four deterministic checks, fictional vehicle state, route provenance and
historical REPLAY warning before explicit AI analysis.

The assessed result is now one primary operator card emphasizing the unchanged
operator message, uncertainty, concise recommended human-review actions and
the human-review-required status. A native `Evidence & limitations` disclosure
retains supporting and missing evidence, backend limitations, possible
consequences and the assessment ID. Live Warnings now gives the existing
normalized persisted provider description prominent presentation beneath the
road/title; no API or persistence change was needed.

Focused verification passed: web typecheck, lint, production build and
`git diff --check`.

---

# Completion Criteria

Iteration 004 is complete when an operator can:

1. open LieferRadar and see actual persisted shipments;
2. identify shipments requiring attention without inspecting every shipment;
3. inspect today's persisted LIVE Autobahn warnings on shipment roads;
4. open SHP-002;
5. inspect deterministic disruption evidence;
6. explicitly request AI analysis;
7. receive a concise evidence-constrained assessment;
8. see uncertainty and human-review recommendations.

The reproducible interview demonstration must support:

`START`
→ dashboard does not yet surface the historical warning
→ API simulation to `NEAR_DISRUPTION`
→ dashboard surfaces SHP-002 under Needs Attention
→ operator reviews shipment
→ deterministic evidence is visible
→ operator requests AI analysis
→ human-review recommendations are shown.
