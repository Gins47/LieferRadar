# Accelerated MVP delivery

**Status:** Approved 2026-10-04  
**Authority:** [MVP scope and decision register](mvp-scope.md)

The remaining MVP is organized as three outcome-based iterations. Each ends
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
The replay command correctly rejects a missing demo database URL; actual replay
and a live-persistence smoke check await a separately provisioned
`lieferradar_demo_*` database. Full lint has the pre-existing unused `metadata`
error in the legacy Zod pipe.

## Iteration B — route, simulator and visualization

Deliver one verified Lübeck-to-Hamburg A1 GeoJSON route fixture, minimal route
and latest-position persistence, deterministic manual reset/advance controls,
and a simple Next.js visualization.

Candidate matching remains conservative: route proximity alone is insufficient;
direction, timing, road/segment evidence and missing data must be shown.
No general route management, dynamic routing or additional map SDK is planned.

Acceptance gate: route provenance and geometry review, simulator/matching
negative controls, API regressions, and frontend type/build checks.

## Iteration C — AI-assisted operator decision

Extend the existing Python service with one versioned, structured disruption
analysis contract. NestJS supplies bounded candidate evidence and remains the
source of supply-chain state. Python returns validated evidence, uncertainty,
possible impact and recommendations.

Record one simulated approval/rejection against the exact assessment context.
AI cannot cancel, reroute or otherwise modify shipments.

Acceptance gate: mocked Python reasoning tests, cross-service contract checks,
stale-context/duplicate-decision tests and a repeatable end-to-end scenario.

## Demonstration provenance

Live collection, recorded warning replay and simulated journey time are separate
facts. The fallback demonstration uses authentic recorded A1 warning data, the
synthetic `SHP-002` shipment and a visible historical simulation clock. It must
never describe replayed data as a live provider response or simulated shipment
information as real-world telemetry.
