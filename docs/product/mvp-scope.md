# LieferRadar — MVP Scope and Decision Register

**Status:** Approved MVP baseline  
**Version:** 1.2 · 2026-10-04<br>
**Approval date:** 2026-10-03  
**Repository location:** `docs/product/mvp-scope.md`  
**Purpose:** Single source of truth for MVP product scope, agreed architectural decisions, delivery sequence, open concerns and controlled changes.

> This document consolidates decisions made in project discussions. It is not evidence that every planned feature is implemented. The current implementation status is based on the latest reported Codex verification, not an independent repository audit.

## 1. Product objective

Build a demonstrable **AI-assisted logistics disruption copilot**. The system ingests official German Autobahn disruptions, tracks a simulated shipment vehicle, identifies *potentially* affected shipments through deterministic evidence, and uses a Python AI service to interpret ambiguity and propose actions for a human dispatcher. The dispatcher retains control of operational decisions.

**Primary MVP demonstration:** A synthetic shipment (`SHP-002`) travelling **Lübeck → Hamburg** on the **A1** encounters a relevant warning near **Bargteheide–Ahrensburg**. The system shows the warning and simulated vehicle position, identifies the shipment as a *candidate* for impact assessment when supported by route/direction/time evidence, provides an explainable AI assessment, and allows the operator to review a proposed response.

**Success principle:** Do not claim a shipment is affected solely because its planned route contains `A1`. Road segment, direction, timing and vehicle location require consideration; missing evidence must remain explicit.

## 2. Approved MVP scope

### A. Logistics backend (NestJS / TypeScript)
- Persist suppliers, products and shipments in PostgreSQL.
- Preserve `GET /shipments/:id` and its established response contract.
- Maintain deterministic fixtures for `SHP-001` (Stuttgart → Munich, A8) and `SHP-002` (Lübeck → Hamburg, A1).
- Keep business logic in services and persistence in repositories.

### B. Autobahn disruption data
- Collect warnings/closures from the **official German Autobahn API** in a later integration phase; retain original German text and provider geometry/raw payload.
- Maintain **one latest-state record** per `(source, provider_id)` in PostgreSQL, not a historical event stream.
- Canonically hash semantic content to classify observations as new, changed or unchanged.
- Distinguish LIVE and REPLAY; reject stale updates and prevent replay from replacing newer live state.
- Preserve provider timestamp semantics: omitted, explicit null or supplied value.
- Retain active records for map/API retrieval. Resolve only after **two consecutive qualifying complete live collections** omit a warning. A failed, incomplete or replay collection cannot prove resolution. This policy is planned, not yet implemented, and must be revisited if provider reliability warrants it.
- Do not use warning hash alone to suppress assessment when shipment or vehicle context changes.

### C. Disruption API and retrieval
- Filter latest-state warnings by motorway, category and relevant date criteria.
- Use UTC for stored timestamp instants and internal service communication. Interpret calendar-date filters in Europe/Berlin and convert each local midnight independently inside PostgreSQL for UTC comparisons, without a new timezone dependency. See [Database architecture](../architecture/database.md) for the CP5 implementation clarification.
- Provide deterministic pagination and REST endpoints for dashboard consumption.
- Date filtering must not imply historical reconstruction.

### D. Planned route and mock vehicle tracking
- **MVP decision:** Use one **verified, road-following Lübeck → Hamburg A1 GeoJSON route fixture**, exported once from a route planner and reviewed for suitability; no runtime routing API dependency.
- For the approved six-hour [Iteration 003 demonstration](../iterations/003-ai-disruption-demo.md), use the supplied ORS `driving-car` export as immutable file-backed route data. Its geometry is accepted for simulated playback only; it does not establish HGV suitability or historical road conditions. Final corridor verification remains B1 work. No route table is required.
- Implement a **small NestJS simulator module**, not a separate microservice.
- Associate a mock vehicle with `SHP-002`; advance simulated coordinates along the verified route and publish timestamped position updates. Include a minimal journey state; add speed/heading only as required for the demonstration.
- Persist the latest vehicle position. Movement history is optional, not required for MVP.
- Iteration 003 uses one PostgreSQL vehicle-state row with fictional driver metadata, a route hash, historical simulation clock and revision-protected manual reset/advance. Preserve shipment status and the existing two-hour SHP-002 schedule.
- Keep simulated telemetry clearly labeled; do not fabricate disruption impact or use a straight line between cities as a driving route.

### E. Candidate matching
- Perform deterministic filtering in NestJS before invoking AI.
- Compare remaining planned route, warning geometry/segment, supported direction evidence, timing and vehicle position where available.
- Treat provider GeoJSON point ordering as **insufficient evidence of carriageway direction**.
- Express uncertain matches as *possible* impact rather than a confirmed disruption.
- Reassess when warning content **or relevant shipment/vehicle context** changes.

### F. Python AI service
- Retain separate FastAPI/Pydantic service and its independently managed `ai` database schema/Alembic migrations.
- Receive bounded, structured warning evidence and candidate shipment/vehicle context from NestJS.
- Interpret original German descriptions, identify evidence and uncertainty, and return validated structured assessments and suggested operator actions.
- Keep orchestration outside HTTP routes, and include timeouts, error handling, logging and focused evaluation cases.
- AI must not independently cancel shipments, reroute vehicles or notify drivers.
- Iteration 003 prioritizes one versioned structured assessment with validated evidence references, explicit uncertainty and a bounded real LLM call. Existing RAG remains available but is not required for this flow; no assessment cache or history is required.

### G. Minimal operator experience
- Show shipments, active disruptions and the simulated vehicle on a map or equivalent clear demo interface.
- Display potential impact, supporting evidence, uncertainty and AI suggestions.
- Provide a human review/approval step before any operational action. For the MVP, **recording a simulated decision is sufficient**; real driver messaging or operational rerouting is not required.
- The six-hour demonstration permits an optional one-page Next.js/React Leaflet interface using OSM tiles, with a 45-minute target and strict 60-minute limit. Use HTTP/JSON output if frontend work is cut. Recording approval/rejection is deferred from Iteration 003 and remains required for full MVP completion.
- Authentication implementation is deferred for the loopback-only demonstration. Mutations remain explicitly enabled, demo-only and unavailable in production; public deployment requires an approved authentication design.

### H. Quality and demonstration
- Use deterministic fixtures for automated tests; live provider calls are not required during tests.
- Cover migrations, persistence, replay/staleness, concurrent updates, HTTP contracts, simulator progression, candidate matching and structured AI output.
- Make the A1 demo repeatable without external routing or live GPS dependencies.

## 3. Explicitly out of scope for MVP

- Runtime route calculation or a paid/external routing API integration.
- Automatic rerouting, route optimization or a fleet-wide dispatch engine.
- Real vehicle GPS devices, third-party telematics or production driver messaging.
- Autonomous shipment cancellation, refund execution or unapproved driver notification. Existing refund functionality, where present, should not be removed; integration is deferred.
- A full historical warning event store, extensive vehicle telemetry history or production-scale geospatial analytics.
- Claims of precise carriageway impact without adequate evidence.

## 4. Architecture and data ownership

| Component | Owns | Does not own |
|---|---|---|
| NestJS logistics | Shipments, suppliers, products and APIs | AI inference |
| NestJS disruption integration | Official collection, normalization, latest warning state and lifecycle | Driver decisions |
| NestJS simulator | Predefined route playback and latest mock vehicle position | Real GPS acquisition |
| NestJS matching | Deterministic candidate identification and evidence packaging | Inventing missing warning details |
| Python FastAPI | Structured AI interpretation and suggested actions | Shipment source of truth or automatic operational actions |
| Operator UI | Display and explicit human review | Unapproved automation |

**Persistence:** PostgreSQL with `pg`, `node-pg-migrate` and SQL repositories for NestJS. Explicit migrations and seeds; no automatic schema changes or seeding on application startup. Python migrations remain separate.

## 5. Current status (reported 2026-10-04)

| Work | Status | Evidence / remaining work |
|---|---|---|
| Iteration 001 logistics core | Complete | Existing shipment API and fixtures |
| CP1 database infrastructure | Complete | Isolated PostgreSQL test runner and migrations |
| CP2 logistics persistence | Complete | Schema and idempotent transactional fixtures |
| CP3 PostgreSQL-backed shipment API | Complete | Shipment HTTP regressions |
| CP4 disruption persistence | Complete | CP5.4 confirmed persistence/hash/write paths unchanged; concurrency, replay, timestamp merging and lifecycle regressions pass |
| CP5 disruption filtering | Complete | CP5.4: Berlin/DST boundaries, pagination and authentic warning preservation verified; see [Iteration 002](../iterations/002-autobahn-integration.md#cp5-implementation-and-verification) |
| CP6 disruption REST endpoints | Complete; Iteration A review pending | PostgreSQL-backed list/detail endpoints preserve warning evidence and validate query input |
| Official live Autobahn warnings | Implemented; user reports manual live verification complete | User confirmed collection/retrieval, LIVE provenance, repeated collection without duplicate rows and disabled-endpoint 404; recorded fixture replay still needs confirmation; closures remain deferred |
| Verified A1 route fixture + simulator | Route export supplied; B1–B3 not started | Preliminary geometry comparison recorded in [Iteration 003](../iterations/003-ai-disruption-demo.md); final verification and simulator pending |
| Deterministic candidate matching | Not started | Must avoid motorway-only conclusions |
| Python disruption assessment | Not started; approved priority | Iteration 003 B2/B4: existing FastAPI/Pydantic/LangChain foundation, real structured reasoning and evaluation |
| Operator demonstration | Not started; frontend optional for Iteration 003 | One time-limited map or HTTP/JSON flow; approval/rejection recording deferred |

**Maintenance:** Earlier Iteration A verification passed 53 unit, 37 isolated PostgreSQL and 9 HTTP tests, plus TypeScript and production build. Full lint reported one pre-existing unused `metadata` finding. Subsequent user-performed live checks are recorded separately above; this documentation update did not rerun application tests or confirm replay. Verify current repository status before marking subsequent work complete.

## 6. Accelerated delivery sequence

The delivery sequence and its approved six-hour revision are recorded in
[Accelerated MVP delivery](accelerated-delivery.md). It retains the existing
checkpoint evidence. The original sequence was:

1. **Iteration A:** warning collection, controlled replay and disruption HTTP retrieval.
2. **Iteration B:** one verified A1 route fixture, deterministic simulator, conservative candidate matching and a simple Next.js visualization.
3. **Iteration C:** one structured Python assessment workflow and a simulated human approval/rejection record.

**Approved revision, 2026-10-04:** [Iteration 003](../iterations/003-ai-disruption-demo.md) combines essential B/C work into six hours: B1 route verification, B2 Python reasoning, B3 persisted simulation, B4 end-to-end AI integration, B5 optional map and B6 acceptance. Protect the AI allocation; stop frontend work after 60 minutes. Approval/rejection recording moves to later work and remains part of the full MVP definition. Iteration 003 completion must not be presented as full MVP completion.

Each outcome ends with verification, diff review and explicit authorization
before a commit or the next outcome. Automatic resolution, background
synchronization, dynamic routing and public mutation access remain deferred.

## 7. Decision register

| ID | Decision | Rationale | Status |
|---|---|---|---|
| D01 | NestJS owns logistics and deterministic matching; Python owns AI interpretation | Clear responsibilities and testability | Approved |
| D02 | Use official Autobahn data rather than a third-party aggregator where feasible | Clear source and original evidence | Approved direction; API behavior still needs validation |
| D03 | Latest-state disruption records keyed by `(source, provider_id)` | Supports active map and efficient deduplication | Implemented |
| D04 | Replay cannot overwrite newer LIVE state; timestamps preserve omission vs explicit null | Protects observation correctness | Implemented |
| D05 | Resolve after two qualifying complete live collections without a warning | Avoids resolving from one transient omission | Approved provisional policy; implementation pending |
| D06 | Deterministic candidate matching before AI; uncertainty remains visible | Avoids unsupported impact claims | Approved |
| D07 | Use one verified static A1 GeoJSON route for MVP | No runtime routing dependency | Approved; fixture pending |
| D08 | Mock vehicle simulation stays inside NestJS | Limits complexity | Approved |
| D09 | Human approval before operational actions | Keeps operator in control | Approved |
| D10 | No dynamic routing or real GPS integration in MVP | Keeps scope achievable | Approved |
| D11 | UTC for stored timestamps and internal service communication; Europe/Berlin calendar boundaries converted independently inside PostgreSQL, with no new timezone dependency | Correct DST boundaries and comparisons against indexed TIMESTAMPTZ columns; clarifies §2C and CP5 without changing CP4 persistence semantics | Approved 2026-10-03; implemented and verified in CP5 |
| D12 | Use three outcome-based iterations for the interview-ready MVP | Protects the verified persistence foundation while focusing delivery on a repeatable demonstration | Approved 2026-10-04; remaining B/C delivery sequence revised by D16 |
| D13 | Iteration A collects official warnings first; closure collection is deferred unless separately approved | Prioritizes the primary A1 demonstration without delaying safe warning ingestion | Approved 2026-10-04 |
| D14 | Mutation endpoints are disabled by default, local-demo-only, and unavailable in production | Avoids public state-changing operations before an authentication design is approved | Approved 2026-10-04 |
| D15 | Use a separate local demo database and historical simulation clock for recorded A1 evidence | Prevents replay from altering development data or being presented as live information | Approved 2026-10-04 |
| D16 | Combine essential B/C work into six-hour Iteration 003, checkpoints B1–B6; prioritize one real AI assessment | Produces a complete evidence-to-reasoning flow within the available budget | Approved 2026-10-04; implementation not started |
| D17 | Use the supplied passenger-car ORS route as immutable file-backed demo geometry; no route table or runtime routing | Reuses available geometry while disclosing subsequent capture and unverified HGV suitability | Approved 2026-10-04 for simulation; final B1 verification pending |
| D18 | Persist one fictional vehicle/driver state with deterministic historical playback and atomic revision checks | Supports restartable controls without driver management or position history | Approved 2026-10-04; implementation pending |
| D19 | Allow optional Next.js/React Leaflet/OSM prototype, 45-minute target and 60-minute maximum, with HTTP/JSON fallback | Limits frontend effort and protects AI delivery; revises earlier map-SDK deferral | Approved 2026-10-04; implementation pending |
| D20 | Reuse Python FastAPI and installed LLM tooling for one bounded versioned structured assessment; RAG is optional | Keeps facts in NestJS and reasoning in Python without unrelated ingestion work | Approved 2026-10-04; implementation pending |
| D21 | Defer authentication infrastructure and approval/rejection recording from Iteration 003; retain local guards and human authority | No consequential actions are executed; public exposure and full MVP completion retain their separate gates | Approved 2026-10-04; full MVP operator-decision requirement preserved |

## 8. Open concerns and validation gates

| ID | Concern | Consequence | Gate / mitigation |
|---|---|---|---|
| R01 | Provider IDs may change for the same real-world warning | Duplicate or discontinuous warning state | Inspect live examples; document limitations before live sync |
| R02 | Warning observation timestamps may be absent or unreliable | Stale-data precedence could be incorrect | Define trustworthy collection timestamp policy and tests |
| R03 | One `queriedRoad` field retains only the latest accepted retrieval context | Multi-road warning may not appear under all expected road filters | Validate official API cross-road behavior; discuss schema changes if needed |
| R04 | Live provider collections can be partial or fail | False resolution of active warnings | Track collection completeness; never resolve from incomplete/replay results |
| R05 | Exported route may not traverse the exact warning segment or carriageway | Misleading MVP matching demo | Visually verify GeoJSON and programmatically test warning-area overlap before accepting fixture |
| R06 | Warning geometry and text may disagree or lack direction | False-positive impact claims | Preserve original evidence; represent uncertainty; negative tests |
| R07 | Simulator interpolation may not represent real travel time or traffic | False precision | Label simulation, use deterministic timestamps and do not claim real ETA |
| R08 | AI may overstate evidence | Unsafe operator recommendations | Strict structured output, evidence attribution, evaluation and mandatory human approval |
| R09 | Scope expansion could delay a usable demonstration | Incomplete MVP | Use change-control procedure below |
| R10 | A local mutation endpoint could be enabled in the wrong environment | Unapproved external data collection | Require explicit configuration, return 404 by default and disable in production |
| R11 | Supplied route uses `driving-car` and was captured after the warning | Cannot establish HGV legality or historical routing | Label passenger-car geometry and synthetic playback; B1 verifies corridor only |
| R12 | Configured LLM credentials do not prove quota/model access | Real AI demonstration may be blocked despite passing mock tests | Verify one bounded real call in B4; report failure without fabricated assessment |
| R13 | Optional OSM tiles or frontend work may fail or overrun | Visualization may consume the reasoning budget | Preserve attribution, enforce 60-minute limit and retain assessment/HTTP fallback |

## 9. Change-control procedure (mandatory)

**Baseline rule:** Approved MVP requirements and architectural decisions in this document must not be silently changed by a new Codex plan, implementation checkpoint or conversation idea.

For every proposed material change:
1. **Flag it before coding:** identify the affected requirement/decision ID, the proposed change and why it is needed.
2. **Assess impact:** product behavior, architecture/data model, existing contracts/migrations, tests, timeline and demo reliability.
3. **Present options:** retain baseline, adopt the change or defer it. State trade-offs and risks; clearly recommend whether discussion is required.
4. **Obtain explicit approval:** do not implement a material change until we discuss and agree on it.
5. **Update the register first:** record the decision, date, rationale, affected sections and any revised acceptance criteria; then update iteration plans and implement.
6. **Verify and report:** tests and documentation must demonstrate the approved behavior; flag remaining concerns separately.

**Material changes include:** new external runtime dependencies; additional microservices; altered disruption identity/lifecycle; autonomous actions; new required data sources; major database ownership changes; or any feature that significantly increases MVP delivery effort.

**Minor changes:** naming, test organization and local refactoring that preserve behavior may proceed within an approved checkpoint, but should be reported.

### Change log

| Date | Version | Change | Approval |
|---|---|---|---|
| 2026-10-03 | 1.0 | Initial consolidated MVP scope and decision register | Approved |
| 2026-10-03 | 1.0 | Recorded D11: CP5 timezone implementation clarification for §2C; database and iteration documentation aligned | Explicit user approval |
| 2026-10-04 | 1.1 | Approved accelerated A/B/C sequence and D12–D15 | Explicit user approval |
| 2026-10-04 | 1.2 | Approved six-hour Iteration 003 and D16–D21; supplied car-route limitation, latest vehicle state, optional Leaflet map and deferred operator recording documented | Explicit user approval; documentation only |

## 10. Definition of MVP done

The MVP is complete when a reviewer can run a documented, repeatable scenario showing: a stored or freshly fetched authentic Autobahn warning; a verified planned A1 route; a mock vehicle moving along that route; conservative identification of a potentially affected shipment; a structured, evidence-grounded Python assessment; and an operator-visible review/approval step. Existing shipment API behavior and isolated automated tests must continue to pass. The demo must disclose simulation and uncertainty rather than presenting them as real-world certainty.
