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

## Architecture Rules

- NestJS is the source of truth for supply-chain state.
- The AI service must not directly modify supply-chain state.
- External API DTOs must not leak into the domain.
- Prefer small, incremental changes.
- Reuse existing infrastructure before rewriting it.
- Do not introduce new infrastructure without a concrete requirement.

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

For substantial changes:

1. inspect the relevant code;
2. propose a short plan;
3. implement only the requested scope;
4. run relevant tests;
5. summarize the changes.

Do not refactor unrelated code.

Do not claim tests passed unless they were actually executed.
