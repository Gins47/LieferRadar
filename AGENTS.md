# LieferRadar

LieferRadar is an AI-powered Supply Chain Disruption Copilot.

## Core Principle

Deterministic systems establish facts.
AI reasons over verified facts and proposes actions.
Humans authorize consequential actions.
The backend executes approved actions.

## Services

- `services/api`: NestJS application and business domain
- `services/ai-service`: Python AI reasoning and RAG
- `services/web`: Next.js operator presentation layer

## Architecture Rules

- NestJS is the source of truth for supply-chain state.
- The AI service must not directly modify supply-chain state.
- External API DTOs must not leak into the domain.
- Prefer small, incremental changes.
- Reuse existing infrastructure before rewriting it.
- Do not introduce new infrastructure without a concrete requirement.

Database decisions are recorded in [Database architecture](docs/architecture/database.md).

## MVP governance

[MVP scope and decision register](docs/product/mvp-scope.md) is the
authoritative reference for approved product scope, requirements,
architecture decisions and known risks.

Before planning or implementing a change, read the MVP document and the
relevant iteration documentation.

If a proposed change conflicts with the approved MVP, adds material
complexity or changes an architectural decision:

1. flag the concern;
2. explain its impact and available alternatives;
3. obtain explicit user approval before proceeding; and
4. update the MVP decision register only after approval.

## Migration

This repository is being migrated from a refund/customer-support
system into LieferRadar.

Before replacing existing code:

1. understand its current responsibility;
2. identify reusable infrastructure;
3. inspect existing tests;
4. prefer adaptation over rewriting.

See `docs/migration.md` for the migration plan.

## Development

For planning, implementing, or reviewing an iteration checkpoint, use the
[iteration-workflow skill](.agents/skills/iteration-workflow/SKILL.md).

For substantial changes:

1. inspect the relevant code;
2. propose a short plan;
3. implement only the requested scope;
4. run relevant tests;
5. summarize the changes.

Do not refactor unrelated code.

Do not claim tests passed unless they were actually executed.
