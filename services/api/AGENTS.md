# NestJS API

- Organize business features as NestJS modules. Register controllers and providers in their feature module.
- Keep controllers focused on HTTP input and responses. Put business checks and orchestration in services; keep data lookup and persistence behind repository code.
- Validate request bodies and headers at the controller boundary. Reuse the existing Zod validation pipe and define DTO schemas separately from domain types.
- Keep supply-chain state and deterministic calculations in this service. Do not pass provider response shapes or HTTP DTOs into domain logic; map them at the boundary.
- Keep provider-specific parsing and API calls inside the relevant integration module.
- Add focused Jest tests for business rules and controller behavior. Mock external providers and repositories in unit tests; use e2e tests for HTTP contracts.
- Preserve existing reliability patterns such as idempotency, uncertain-outcome handling, and reconciliation when they can support consequential supply-chain actions. Do not remove the refund capability without reassessing it as a possible downstream action workflow.
