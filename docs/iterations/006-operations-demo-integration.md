# Iteration 006 — Operations Demo Integration

## Status

Implemented-state record for the Operations/demo integration. This document
describes the current operator-facing workflow; it does not rewrite the
historical Iterations 003 or 004 records.

## Goal

Bring persisted shipment, disruption, deterministic-evidence and AI
capabilities into one reproducible operator workflow:

```text
Shipment → journey/vehicle context → deterministic disruption evaluation
    → operator review state → optional AI explanation → human review
```

The LLM does not decide whether a traffic warning is relevant to a shipment.
NestJS establishes deterministic evidence and controls whether an operator can
request an AI assessment.

## Operations read model

`GET /operations/shipments` surfaces persisted shipments for the dashboard.
Prepared demo shipments are evaluated through the existing deterministic path;
ordinary shipments remain `NOT_EVALUATED` rather than receiving fabricated
warning evidence.

`GET /operations/shipments/:id` is the generic operator detail read model. It
returns shipment data and, when a supported prepared context exists, its
vehicle context, deterministic evidence, review state/reason and the
operator-facing `aiAssessmentAvailable` capability. The list response remains
compact and does not include warning detail.

## Prepared A1 demo contexts

The guarded preparation flow persists the factual inputs: shipment assignment,
fictional vehicle state, fixed route position and simulated time. The existing
evidence engine derives the review state; the state is not selected by a
shipment-specific outcome branch.

| Shipment | Prepared factual situation | Derived operator state | AI action |
| --- | --- | --- | --- |
| `SHP-004` | Journey start; historical warning not yet observable | `WARNING_NOT_YET_OBSERVED` | Unavailable |
| `SHP-002` | Approaching the historical A1 warning | `NEEDS_REVIEW` | Available |
| `SHP-003` | Vehicle has passed the warning | `EXCLUDED` | Unavailable |

The states use persisted position and simulated time alongside the approved
route and selected warning. Normal persisted shipments without a prepared
context remain `NOT_EVALUATED`.

## Historical warning and replay

The reproducible scenario uses the authentic historical A1 warning represented
by the recorded Autobahn fixture. Preparation replays it through the existing
normalization and persistence path and requires the exact selected warning to
remain `REPLAY` evidence.

Replay makes the interview/demo independent of current LIVE traffic state. It
is historical evidence, not live traffic. Any provider-reported travel-time
loss remains provider traffic information; it is not presented as a shipment
delay or ETA impact.

## Deterministic evidence and AI gating

Low-level deterministic candidate eligibility and the operator action are
related but distinct. Definite deterministic exclusions do not reach the AI
service; unknown evidence remains explicit rather than becoming an invented
conclusion.

For the current operator read model, `aiAssessmentAvailable` is true only for
`NEEDS_REVIEW`:

| Review state | `aiAssessmentAvailable` |
| --- | --- |
| `NEEDS_REVIEW` | Yes |
| `EXCLUDED` | No |
| `WARNING_NOT_YET_OBSERVED` | No |
| `NOT_EVALUATED` | No |

The frontend renders this backend-owned capability and does not reproduce the
evidence or eligibility rules.

## Review warning

For prepared detail reads, Operations composes `reviewWarning` from the warning
already selected by `DemoService.getShipmentScenario()`. It includes compact
identity, provenance, timing and provider-information fields for the operator
view. It does not create a shipment-warning relationship, perform another
warning lookup, or require the browser to call a disruption endpoint.

The UI displays warning information only for `NEEDS_REVIEW`. In particular,
`WARNING_NOT_YET_OBSERVED` does not expose future historical-warning details
as though they were available to the operator at that simulated time.

## Operator UI

Prepared shipments are presented as:

```text
[ Shipment ] [ Vehicle ]

[ Potential disruption / review state ]

[ AI assessment, when requested and allowed ]
```

Ordinary shipments are presented as:

```text
[ Shipment ]

[ Current review state ]
```

Raw deterministic enum grids are retained in backend evidence but are not the
primary operator presentation. The UI presents a human-readable review reason,
shows warning information only when appropriate, and exposes the AI action
only when `aiAssessmentAvailable` is true. The resulting assessment remains an
explicit human-review aid.

## AI integration

The successful assessment path is:

```text
NestJS → structured evidence snapshot → FastAPI → OpenAI
    → structured assessment → operator UI
```

NestJS binds the request to the current vehicle revision and warning content
hash, then re-reads authoritative state before returning an assessment. FastAPI
produces a validated explanation, uncertainty, possible consequences and
recommended human-review actions. It does not modify shipment state, reroute
shipments or execute operational actions.

Successful assessment evidence has a compact AI-response shape and remains
separate from Operations deterministic evidence in the UI, preventing it from
replacing the latter during rendering.

## Observability and evaluation

The AI service records LLM execution through Langfuse tracing. Its regression
evaluation suite exercises structured disruption reasoning and deterministic
output checks to detect behavioral regressions. These safeguards do not claim
an AI accuracy percentage or replace human review.

## Current acceptance checklist

- [x] Operations dashboard surfaces persisted shipments through the Operations read model.
- [x] Generic shipment detail supports prepared and ordinary persisted shipments.
- [x] `SHP-004` presents its warning-not-yet-observed review without leaking warning details in the UI.
- [x] `SHP-002` derives `NEEDS_REVIEW` and exposes the AI action.
- [x] `SHP-003` derives `EXCLUDED` and exposes no AI action.
- [x] Ordinary shipments remain `NOT_EVALUATED` without fabricated evidence.
- [x] Successful AI results render without replacing Operations deterministic evidence.
- [x] Historical replay is identified in the review presentation.
- [x] Provider travel-time loss is not represented as a shipment delay.
