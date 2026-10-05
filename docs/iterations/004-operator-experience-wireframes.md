# Iteration 004 --- Operator Experience Wireframes

## Purpose

This document is a presentation reference for:

-   B2 --- Operations Dashboard + Live Warnings
-   B3 --- Shipment Detail + Compact AI Assessment

B1 does not need this document.

These wireframes communicate information hierarchy, operator workflow,
approximate page structure, and desired simplicity. They are NOT
pixel-perfect specifications.

Implementation should reuse the existing Next.js application, Tailwind
styling, shadcn/ui foundation, and current visual language where
appropriate. Do not introduce additional UI libraries solely to
reproduce these wireframes.

------------------------------------------------------------------------

# Navigation

Keep top-level navigation minimal.

``` text
LIEFERRADAR

Operations        Live Warnings
────────────────────────────────────────────────────────────────────
```

Routes:

-   `/` → Operations
-   `/warnings` → Live Warnings
-   `/shipments/:id` → Shipment detail

No sidebar is required.

------------------------------------------------------------------------

# Operations Dashboard

## Purpose

The dashboard should answer:

1.  What is happening across my shipments?
2.  Which shipments require my attention?

Summary counters provide context. Needs Attention is the primary
operational area.

## NEAR_DISRUPTION example

``` text
Operations

Monitor shipments and disruptions requiring operator review.

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ Shipments        │  │ Need attention   │  │ Live warnings    │
│        2         │  │        1         │  │        3         │
└──────────────────┘  └──────────────────┘  └──────────────────┘

Needs attention
────────────────────────────────────────────────────────────────────

┌──────────────────────────────────────────────────────────────────┐
│ POTENTIAL DISRUPTION                              NEEDS REVIEW   │
│ SHP-002 · Lübeck → Hamburg                       PLANNED        │
│ Vehicle: VEH-DEMO-002                                            │
│ A1 · Bargteheide → Ahrensburg                                   │
│ Potential disruption on the remaining journey                   │
│                                      [ Review shipment → ]       │
└──────────────────────────────────────────────────────────────────┘

Other shipments
────────────────────────────────────────────────────────────────────

┌──────────────────────────────────────────────────────────────────┐
│ SHP-001 · Stuttgart → Munich                     PLANNED        │
│ Assessment not available                                        │
└──────────────────────────────────────────────────────────────────┘
```

The numbers are illustrative. Actual values must come from NestJS.

------------------------------------------------------------------------

# START Dashboard State

Before the historical warning has been observed in simulated time:

``` text
Shipments          Need attention          Live warnings
    2                     0                     ...

Needs attention
────────────────────────────────────────────────────────────────────
No shipments currently require review based on available evidence.

Other shipments
────────────────────────────────────────────────────────────────────

SHP-002 · Lübeck → Hamburg
Historical warning not yet observed at simulated time

SHP-001 · Stuttgart → Munich
Assessment not available
```

Do not replace these states with Safe, Unaffected, or Clear unless
NestJS has actually established that fact.

------------------------------------------------------------------------

# Primary Demo Transition

``` text
Developer/API

SHP-002
   ↓
 START
   ↓ Dashboard refresh
 Needs attention = 0
   ↓ POST guarded demo vehicle-position API
 NEAR_DISRUPTION
   ↓ Dashboard refresh
 Needs attention = 1
   ↓
 SHP-002 appears
   ↓
 Review shipment
```

No automatic movement, polling, timers or WebSockets are required.

------------------------------------------------------------------------

# Live Warnings

## Purpose

Answer:

> What LIVE Autobahn warnings have been observed today on roads used by
> saved shipments?

``` text
Live Warnings

LIVE Autobahn warnings observed today on roads used by saved shipments.
Today · <date>

A1                                                    3 warnings
────────────────────────────────────────────────────────────────────

┌──────────────────────────────────────────────────────────────────┐
│ A1                                                    LIVE       │
│ <provider warning title / description>                           │
│ Direction          <provider direction>                          │
│ Warning time       <provider/start timestamp>                    │
│ Last observed      <observation timestamp>                       │
│ Source             Autobahn                                      │
└──────────────────────────────────────────────────────────────────┘
```

Only display fields actually supplied by the backend. Do not manufacture
provider data.

## Empty state

``` text
No LIVE Autobahn warnings were observed today
on roads used by saved shipments.
```

Never use historical REPLAY data to fill this page.

------------------------------------------------------------------------

# Shipment Detail

Route: `/shipments/SHP-002`

The page should feel like an operator investigation rather than a
simulation console.

``` text
← Operations

SHP-002                                             NEEDS REVIEW
Lübeck → Hamburg
PLANNED

Shipment
────────────────────────────────────────────────────────────────────
Vehicle                         Pickup
VEH-DEMO-002                    06:30 UTC

Planned delivery
08:30 UTC

Route
────────────────────────────────────────────────────────────────────
Lübeck ──────────── VEHICLE ─── WARNING ───────────── Hamburg

Illustrative route progress based on backend-provided state.

Potential disruption
────────────────────────────────────────────────────────────────────
A1 · Bargteheide → Ahrensburg                      REPLAY
Historical Autobahn evidence
Direction: Lübeck → Hamburg

Provider-reported delay information belongs to the road warning
and is not a shipment delay.

Deterministic evidence
────────────────────────────────────────────────────────────────────
Geography        Direction       Position        Timing
Near route       Compatible      Ahead           Possible

                                             [ Analyze with AI ]
```

The actual displayed labels should map cleanly from backend values. Do
not independently reinterpret evidence in React.

------------------------------------------------------------------------

# AI Assessment --- Primary View

After `Analyze with AI`:

``` text
AI assessment                                      HUMAN REVIEW
────────────────────────────────────────────────────────────────────

<backend operatorMessage>

Uncertainty
<backend uncertainty>

Recommended actions

[ Monitor ]   [ Verify information ]   [ Review plan ]

Human review is required before taking operational action.

▸ Evidence & limitations
```

Prioritize operator message, uncertainty, recommended actions, and
human-review requirement. Do not create another AI-generated or
frontend-generated summary.

------------------------------------------------------------------------

# AI Assessment --- Expanded Evidence

``` text
▼ Evidence & limitations

Supporting evidence
<supporting evidence>

Missing evidence
<missing evidence>

Limitations
<limitations>

Possible consequences
<possible consequences>

Assessment
ID: <assessment ID>
```

All structured evidence remains available. Progressive disclosure
reduces visual noise; it does not remove evidence.

------------------------------------------------------------------------

# Simulation Controls

The operator UI must NOT include:

``` text
[ Set START ]
[ Set NEAR_DISRUPTION ]
```

Simulation is a developer/demo concern. The existing guarded API remains
available.

``` text
API simulation
      ↓
backend state
      ↓
refresh browser
      ↓
operator observes changed state
```

------------------------------------------------------------------------

# Visual Direction

Use the existing shadcn/ui foundation. Prefer clear typography, generous
spacing, strong information hierarchy, compact operational badges,
readable empty states, responsive layouts, and one obvious primary
action.

Avoid excessive nested cards, decorative gradients, large hero sections,
fake analytics, risk gauges, charts without meaningful data, excessive
icons, animation, and dashboard clutter.

Operational state should remain understandable without relying only on
color.

------------------------------------------------------------------------

# Presentation Boundary

The UI may reorganize information, shorten labels, progressively
disclose details, and emphasize important backend states.

The UI must NOT derive new domain facts.

Next.js must never independently determine:

-   Needs Attention;
-   disruption eligibility;
-   geographic relationship;
-   direction compatibility;
-   route position;
-   timing compatibility;
-   LIVE/REPLAY provenance.

Those decisions belong to NestJS.

------------------------------------------------------------------------

# Scope Reminder

These wireframes do not imply implementation of Leaflet, maps, charts,
sidebar navigation, polling, WebSockets, animations, new
state-management libraries, or automatic AI execution.

Keep Iteration 004 intentionally small.
