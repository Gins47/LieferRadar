# LieferRadar Architecture

## Services

### services/api

NestJS application.
Owns:

- supply-chain domain state
- PostgreSQL persistence
- external data ingestion
- deterministic disruption checks
- vehicle simulation
- candidate selection
- orchestration with AI service

Must not delegate deterministic business decisions to the LLM.

### services/ai-service

FastAPI application.
Owns:

- explanation of candidate disruption evidence
- structured LLM reasoning
- uncertainty communication
- policy RAG

Does not own:

- geographic calculations
- shipment state
- candidate selection
- operational actions

### services/web

Operator interface.
Displays backend state and AI explanations.
Does not duplicate backend business rules.

`services/api` and `services/web` are the repository's npm workspace packages.
`services/ai-service` remains managed by its Python environment and dependency tooling.

The web service uses TypeScript, Tailwind CSS and shadcn/ui primitives.

### Map presentation

B5 uses a lightweight illustrative route visualization rather than an interactive
map. If interactive geographic visualization is needed later, Leaflet is the
preferred map library. Map rendering remains presentation only: NestJS continues
to own all route, disruption, and relevance calculations.

## Core flow

External evidence
↓
NestJS ingestion
↓
PostgreSQL
↓
Deterministic candidate checks
↓
Candidate evidence
↓
Python AI service
↓
Structured explanation
↓
Operator UI
↓
Human decision

## Ownership

NestJS = facts + deterministic decisions
Python AI = reasoning/explanation over supplied evidence
Frontend = presentation
Human = operational decision

## Current MVP

SHP-002
→ VEH-DEMO-002
→ Lübeck–Hamburg demo route
→ historical A1 REPLAY warning
→ deterministic checks
→ AI explanation
→ operator review

The demo uses the same explicitly configured local LieferRadar PostgreSQL
database as the API. Guarded setup creates fictional logistics/vehicle state,
then replays and verifies the exact historical `REPLAY` warning; current `LIVE`
disruptions may coexist but cannot replace that demonstration evidence.
