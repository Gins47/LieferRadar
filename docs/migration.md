# LieferRadar

LieferRadar is an AI-powered Supply Chain Disruption Copilot.

The system combines internal supply-chain data with real-world disruption signals to identify shipments and operations that may be at risk.

It uses deterministic application logic to establish facts, an AI service to reason over those facts and company policies, and human approval before consequential business actions are executed.

## Core Principle

The architecture follows this rule:

**Deterministic systems establish facts.  
AI reasons over verified facts and proposes actions.  
Humans authorize consequential actions.  
The backend executes approved actions.**

Never allow the LLM or AI service to directly execute consequential supply-chain actions.

---

# Architecture

The repository contains two main services:

## NestJS API

The NestJS service owns the application and business domain.

Responsibilities include:

- suppliers
- products
- warehouses
- inventory
- purchase orders
- shipments
- routes
- disruptions
- shipment impact assessment
- recommendations
- approval workflows
- action execution
- external API integrations

External disruption sources may include:

- Autobahn API
- BBK / NINA
- weather services

The NestJS service is the source of truth for supply-chain state.

## Python AI Service

The Python service owns AI-specific capabilities.

Responsibilities include:

- LLM interaction
- disruption risk reasoning
- recommendation generation
- RAG
- policy retrieval
- embeddings and vector search

The Python service receives verified operational context from the NestJS service and returns structured analysis and recommendations.

The Python service must not directly modify supply-chain state.

---

# Target Workflow

The intended application flow is:

External disruption signals

→ normalized disruption data

→ deterministic shipment impact detection

→ business context enrichment

→ AI risk analysis

→ recommended actions

→ human review

→ approval or rejection

→ controlled action execution

→ audit trail

Do not move deterministic calculations into the LLM when they can reliably be implemented in application code.

Examples include:

- stock coverage calculations
- shipment/disruption time overlap
- route matching
- supplier approval status
- monetary thresholds
- approval requirements

---

# Domain Direction

The main supply-chain concepts are expected to include:

- Supplier
- Product
- Warehouse
- Inventory
- PurchaseOrder
- Shipment
- Route
- Disruption
- ShipmentImpact
- Recommendation
- Approval
- ActionExecution

These concepts should evolve incrementally.

Do not create all domain abstractions upfront unless required by the current implementation.

Prefer implementing one complete vertical slice before generalizing.

---

# External Integrations

External provider models must not leak into the core domain.

Use the boundary:

External API

→ provider DTO

→ mapper / adapter

→ LieferRadar domain model

For example:

Autobahn API

→ AutobahnWarningDto

→ AutobahnDisruptionMapper

→ Disruption

Keep provider-specific parsing and transformation inside the corresponding integration module.

Do not make domain services depend directly on external API response structures.

---

# AI Boundaries

The AI service should reason only over context supplied to it or retrieved from approved knowledge sources.

The AI may:

- explain disruption risks
- summarize operational impact
- retrieve relevant company policies
- propose mitigation strategies
- recommend actions
- explain the evidence behind recommendations

The AI must not:

- directly create purchase orders
- reroute shipments
- cancel shipments
- modify inventory
- modify production schedules
- contact customers or suppliers
- perform other consequential business actions

Those actions must pass through the NestJS application and its authorization/approval workflow.

Prefer structured AI responses over free-form text when responses are consumed by application logic.

---

# Human-in-the-Loop

Read-only operations normally do not require human approval.

Examples:

- reading shipment information
- retrieving inventory
- retrieving supplier information
- calculating stock coverage
- retrieving disruptions

Consequential operations should require explicit approval.

Examples:

- creating a purchase order
- changing a shipment route
- cancelling a shipment
- changing a production schedule
- notifying external parties

The approval decision must be owned by the application layer, not by the LLM.

---

# Reliability

External operations may have uncertain outcomes.

A timeout must not automatically be treated as proof that an external operation failed.

When adapting existing refund-system reliability mechanisms, preserve useful patterns such as:

- idempotency
- explicit operation state
- reconciliation
- safe retries
- UNKNOWN / uncertain outcome handling

Avoid duplicate consequential operations.

For example, retrying a timed-out purchase-order creation must not accidentally create two purchase orders.

Reuse existing reliability infrastructure when appropriate rather than rewriting it unnecessarily.

---

# Existing Codebase

This repository is being migrated from an existing refund/customer-support project.

Do not assume existing code should be deleted simply because its domain terminology refers to refunds or support.

Before replacing existing code:

1. understand its responsibility;
2. determine whether the underlying pattern is reusable;
3. identify dependencies;
4. check existing tests;
5. prefer adapting useful infrastructure over rewriting it.

Existing areas that may contain reusable infrastructure include:

- idempotency
- operation state management
- reconciliation
- external API handling
- database infrastructure
- LLM integration
- embeddings
- vector storage
- RAG ingestion
- RAG retrieval
- structured AI responses
- tests

Domain-specific refund/support behavior can be removed incrementally after equivalent LieferRadar functionality exists.

---

# Development Guidelines

Prefer small, reviewable changes.

Do not attempt to migrate the entire application in one change.

For significant tasks:

1. inspect the relevant existing code;
2. explain the current behavior;
3. identify reusable components;
4. propose the smallest reasonable change;
5. implement only the agreed scope;
6. run relevant tests;
7. summarize the result.

Do not refactor unrelated code while implementing a feature.

Do not introduce infrastructure merely because it may be useful later.

In particular, do not introduce technologies such as:

- Kafka
- RabbitMQ
- Redis
- BullMQ
- MCP
- multi-agent orchestration
- CQRS
- event sourcing

unless the current requirement provides a concrete reason for them.

Existing infrastructure that is already useful does not need to be removed simply because it appears in this list.

---

# TypeScript / NestJS Guidelines

Prefer:

- explicit types
- dependency injection
- small focused services
- clear module boundaries
- DTO validation at API boundaries
- domain-oriented naming
- testable business logic
- constructor injection

Keep controllers thin.

Controllers should primarily:

- validate/request input
- invoke application services
- return responses

Business logic belongs in services/domain components.

Avoid `any` unless there is a strong reason.

Do not expose external provider DTOs from application APIs.

---

# Python AI Service Guidelines

Keep AI-specific concerns inside the Python service.

Separate:

- API routes
- schemas
- LLM clients
- prompts
- retrieval
- ingestion
- domain reasoning

Prefer typed schemas for inputs and outputs.

Prompts should not contain business facts that should come from the NestJS application.

Avoid embedding deterministic business rules solely inside prompts.

Company policies used for RAG should remain distinguishable from application business logic.

---

# Testing

Every meaningful behavioral change should include or update tests.

Prioritize tests for:

- domain rules
- state transitions
- mapping external DTOs
- shipment impact detection
- inventory calculations
- approval rules
- idempotency
- reconciliation
- AI response schema validation

External APIs should normally be mocked in unit tests.

Do not require live external services for the normal test suite.

Before completing a task, run the relevant existing tests and type/lint checks when available.

Do not silently ignore failing tests.

---

# Working With This Repository

Before making a substantial change, first inspect the relevant implementation.

If the requested change affects architecture or multiple modules, present a short implementation plan before editing files.

When completing a task, report:

1. what changed;
2. important design decisions;
3. files added or modified;
4. tests added or updated;
5. commands/tests executed;
6. remaining concerns or follow-up work.

Do not claim tests passed unless they were actually executed successfully.

---

# Migration Strategy

The migration should remain incremental.

The intended high-level order is:

1. understand and preserve reusable infrastructure;
2. introduce the core supply-chain domain;
3. create a working internal shipment scenario;
4. integrate one real disruption source;
5. detect shipment impact deterministically;
6. adapt the AI service for risk analysis;
7. reuse RAG for company policies;
8. introduce human approval;
9. execute approved actions safely;
10. add additional integrations and production hardening.

Do not skip ahead unnecessarily.

The immediate goal is a working vertical slice, not a complete enterprise supply-chain platform.
