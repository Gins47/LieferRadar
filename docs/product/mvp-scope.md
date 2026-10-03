# LieferRadar — MVP Scope and Decision Register

**Status:** Approved MVP baseline  
**Version:** 1.0 · 2026-10-03  
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
- Save/use the planned route as application data; decide its exact persistence shape during the vehicle checkpoint.
- Implement a **small NestJS simulator module**, not a separate microservice.
- Associate a mock vehicle with `SHP-002`; advance simulated coordinates along the verified route and publish timestamped position updates. Include a minimal journey state; add speed/heading only as required for the demonstration.
- Persist the latest vehicle position. Movement history is optional, not required for MVP.
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

### G. Minimal operator experience
- Show shipments, active disruptions and the simulated vehicle on a map or equivalent clear demo interface.
- Display potential impact, supporting evidence, uncertainty and AI suggestions.
- Provide a human review/approval step before any operational action. For the MVP, **recording a simulated decision is sufficient**; real driver messaging or operational rerouting is not required.

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

## 5. Current status (reported 2026-10-03)

| Work | Status | Evidence / remaining work |
|---|---|---|
| Iteration 001 logistics core | Complete | Existing shipment API and fixtures |
| CP1 database infrastructure | Complete | Isolated PostgreSQL test runner and migrations |
| CP2 logistics persistence | Complete | Schema and idempotent transactional fixtures |
| CP3 PostgreSQL-backed shipment API | Complete | Shipment HTTP regressions |
| CP4 disruption persistence | Complete | CP5.4 confirmed persistence/hash/write paths unchanged; concurrency, replay, timestamp merging and lifecycle regressions pass |
| CP5 disruption filtering | Complete; final review changes uncommitted | CP5.4: 37 unit, 37 isolated PostgreSQL and 4 shipment HTTP tests passed; Berlin/DST boundaries, pagination and authentic warning preservation verified; see [Iteration 002](../iterations/002-autobahn-integration.md#cp5-implementation-and-verification) |
| CP6 disruption REST endpoints | Not started | Expose stored warnings |
| Official live Autobahn collection | Not started | Includes completeness-aware lifecycle handling |
| Verified A1 route fixture + simulator | Agreed approach; not implemented | Route acquisition/verification and vehicle module |
| Deterministic candidate matching | Not started | Must avoid motorway-only conclusions |
| Python disruption assessment | Not started | Existing Python service foundation to be reviewed |
| Operator demonstration | Not started | Map, evidence and approval flow |

**Maintenance:** CP5.4 full lint confirms one pre-existing unused `metadata` finding; no CP5 lint regressions remain. TypeScript and production build passed. Verify current repository status before marking subsequent work complete.

## 6. Proposed delivery order

1. **Close CP4:** commit verified CP4.3/CP4.4 work; handle unrelated lint cleanup separately.
2. **CP5–CP7:** implement disruption filtering, REST endpoints and Phase 002A acceptance.
3. **Official collection:** implement selective Autobahn fetching, normalization, idempotent persistence, complete-collection accounting and explicit lifecycle handling; provide a controlled manual trigger before scheduling.
4. **Route fixture and simulator:** obtain and verify the real A1 route geometry; build minimal NestJS playback and latest-position persistence.
5. **Candidate matching:** integrate warning evidence, planned/remaining route and mock position; establish conservative direction/time rules.
6. **Python AI workflow:** agree request/response schema, implement evidence-grounded analysis and evaluate ambiguous scenarios. API contract planning can run earlier in parallel without expanding implementation scope.
7. **Operator demo:** display warning/vehicle/candidate assessment and simulate explicit approval.
8. **End-to-end verification:** repeatable A1 scenario, negative controls (opposite direction, out-of-area, stale warning), failure handling and documentation.

These are delivery stages, not promises of exact dates or a new checkpoint numbering scheme. Align stage labels with the existing iteration document before implementation.

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

## 10. Definition of MVP done

The MVP is complete when a reviewer can run a documented, repeatable scenario showing: a stored or freshly fetched authentic Autobahn warning; a verified planned A1 route; a mock vehicle moving along that route; conservative identification of a potentially affected shipment; a structured, evidence-grounded Python assessment; and an operator-visible review/approval step. Existing shipment API behavior and isolated automated tests must continue to pass. The demo must disclose simulation and uncertainty rather than presenting them as real-world certainty.
