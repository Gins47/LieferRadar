# Accelerated MVP delivery

**Status:** Approved 2026-10-04; six-hour delivery revision approved 2026-10-04<br>
**Authority:** [MVP scope and decision register](mvp-scope.md)

The original MVP sequence used three outcome-based iterations. The approved
six-hour revision below combines essential B/C work into Iteration 003. Each ends
with verification, scope/diff review and explicit authorization before any
commit, push or subsequent iteration.

## Iteration A — live warning backend

Deliver PostgreSQL-backed `GET /disruptions` and `GET /disruptions/:id`, plus
a warning-only official Autobahn collection path.

- Use bounded per-request timeouts and one straightforward retry for transient
  provider failures.
- Validate and normalize warnings at the integration boundary, then upsert
  them through the existing disruption repository.
- Preserve German text, GeoJSON, raw provider payload, provider timestamp
  presence and provenance.
- Keep `POST /integrations/autobahn/collect` disabled unless
  `AUTOBANH_COLLECTION_ENABLED=true` in a non-production local process.
- Replay the recorded A1 warnings only through the development command and a
  separately configured local database named `lieferradar_demo_*`.
- Do not add a scheduler, automatic resolution or closure collection.

Acceptance gate: deterministic provider/normalizer/service tests, isolated
PostgreSQL persistence and HTTP tests, a read-only live provider probe, and
the existing shipment regressions.

**Implementation record, 2026-10-04:** passed 53 unit tests, 37 isolated
PostgreSQL tests and 9 HTTP tests, plus TypeScript, production build, focused
lint and `git diff --check`. A read-only A1 live probe returned one warning.
The replay command correctly rejects a missing demo database URL. Subsequently,
the user reported successful live collection/retrieval, LIVE provenance,
repeated collection without duplicate rows and 404 when collection is disabled.
These are user-performed manual checks; recorded fixture replay remains
unconfirmed. Full lint previously reported the unused `metadata` error in the
legacy Zod pipe. This documentation revision did not rerun application checks.

## Iteration B — route, simulator and visualization

**Original delivery scope; essential work now included in Iteration 003.**

Deliver one verified Lübeck-to-Hamburg A1 GeoJSON route fixture, minimal route
and latest-position persistence, deterministic manual reset/advance controls,
and a simple Next.js visualization.

Candidate matching remains conservative: route proximity alone is insufficient;
direction, timing, road/segment evidence and missing data must be shown.
No general route management or dynamic routing is planned. D19 now permits a
strictly time-limited React Leaflet/OSM prototype for Iteration 003.

Acceptance gate: route provenance and geometry review, simulator/matching
negative controls, API regressions, and frontend type/build checks.

## Iteration C — AI-assisted operator decision

**Original delivery scope; reasoning moves into Iteration 003, while decision
recording remains deferred.**

Extend the existing Python service with one versioned, structured disruption
analysis contract. NestJS supplies bounded candidate evidence and remains the
source of supply-chain state. Python returns validated evidence, uncertainty,
possible impact and recommendations.

Record one simulated approval/rejection against the exact assessment context.
AI cannot cancel, reroute or otherwise modify shipments.

Acceptance gate: mocked Python reasoning tests, cross-service contract checks,
stale-context/duplicate-decision tests and a repeatable end-to-end scenario.

## Iteration 003 — six-hour AI disruption demonstration

**Status:** B1–B2 complete; B3–B6 not started<br>
**Specification:** [AI disruption demonstration](../iterations/003-ai-disruption-demo.md)<br>
**Decisions:** D16–D24 in the MVP register

Deliver one SHP-002 flow using the supplied static ORS passenger-car route,
persisted fictional vehicle state, authentic historical A1 warning, NestJS
deterministic evidence and a real structured Python assessment. Keep the route
file-backed; add one latest-state vehicle table. Use the existing repositories,
database runner, FastAPI/Pydantic and LLM dependency. RAG is not required.

| Checkpoint | Scope | Budget | Dependency |
| ---------- | ----- | ------ | ---------- |
| B1 | Route/provenance verification and limitations | 30 min | Supplied route and warning fixtures |
| B2 | Python structured reasoning and mocked evaluation | 60 min | B1 evidence/contract |
| B3 | Persisted simulation and explicit demo setup | 90 min | B1 route and existing PostgreSQL |
| B4 | Deterministic evidence and real NestJS → Python assessment | 90 min | B2 and B3 |
| B5 | Optional Next.js/React Leaflet/OSM page | 45 min target; 60 min maximum | B3/B4 APIs |
| B6 | Regression checks, real evaluation and walkthrough | 30 min | Required checkpoints and frontend disposition |

Target 345 minutes with 15 minutes contingency. Protect the 150-minute AI
allocation; reduce frontend work first. At the frontend limit, stop and retain
the HTTP/JSON demonstration. Do not silently replace persisted state or a real
LLM assessment with mocks.

Acceptance gate: route provenance, deterministic reset/advance and persisted
restart, relevant/opposite-direction/insufficient-evidence cases, structured
assessment with valid fact references and uncertainty, existing isolated
database/HTTP regressions, and web type/lint/build checks when delivered.
Record one real assessment and the small live evaluation separately from
mocked automated tests. Update B1–B6 progress after each checkpoint.

Operate on loopback with demo-only mutations disabled by default and unavailable
in production. Keep credentials server-side. Authentication infrastructure and
approval/rejection recording are deferred; no operational action is executed.
Full MVP completion still requires the operator-decision workflow. No dashboard,
runtime routing, automatic actions, scheduler, position history or assessment
cache is added by this iteration.

Demo preparation must verify the selected historical warning by exact source and
provider ID with `REPLAY` provenance; it fails if newer LIVE state prevents that
record from being available and never substitutes a different warning. NestJS
excludes definite non-candidates before any Python call. Python rejects a
misrouted request with a conclusive exclusion state, while unknown evidence
remains eligible for assessment. Every AI assessment is tied to the vehicle
revision and warning content hash used to prepare its evidence, so changed state
requires a fresh assessment.

NestJS calculates routes and distances, then sends Python only compact,
evidence-backed reasoning input. Raw geometry, coordinates, revisions and
content hashes remain in NestJS. Unknown checks remain uncertain; they cannot
be converted into deterministic exclusions. Candidate explanations, evidence
explanations, uncertainty and recommended-action rationales are in English.

## Demonstration provenance

Live collection, recorded warning replay and simulated journey time are separate
facts. The fallback demonstration uses authentic recorded A1 warning data, the
synthetic `SHP-002` shipment and a visible historical simulation clock. It must
never describe replayed data as a live provider response or simulated shipment
information as real-world telemetry.

The supplied route was captured on 2026-10-04 using `driving-car`; the warning
is historical evidence from 2026-10-03. Route proximity does not establish
carriageway impact, HGV suitability or event duration. Preserve each source's
timestamps and attribution. Latest disruption state cannot reconstruct history;
historical playback must not treat newer LIVE content as the original warning
or bypass replay precedence. Keep live synchronization disabled in the
historical presentation.
