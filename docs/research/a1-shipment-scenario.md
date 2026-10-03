# A1 shipment fixture scenario

## Purpose

`SHP-002` is a deterministic database fixture for later disruption-matching
tests. It is separate from the Stuttgart-to-Munich A8 regression fixture
`SHP-001` and does not change that scenario.

## Historical warning evidence

The saved authentic provider response is
[a1-warnings-2026-10.03.json](../../services/api/test/fixtures/autobahn/a1-warnings-2026-10.03.json).
The selected warning has provider identifier
`INRIX--vi-avl.2026-10-03_06-53-00-000_003.de0`.

The response identifies `A1 | Bargteheide - Ahrensburg`, supplies the direction
text `Lübeck -> Hamburg`, and reports `QUEUING_TRAFFIC` with a structured start
timestamp of `2026-10-03T06:53:00Z`. Its LineString and original German
description remain in the source fixture.

## Synthetic shipment assumptions

| Field                 | Value                                        |
| --------------------- | -------------------------------------------- |
| Supplier              | `SUP-002` — Lübeck Demo Supplier, Lübeck, DE |
| Shipment              | `SHP-002`                                    |
| Product               | `PROD-001` — ECU Controller                  |
| Quantity              | `500`                                        |
| Pickup                | Lübeck, DE                                   |
| Destination           | Hamburg, DE                                  |
| Planned route         | `A1`                                         |
| Status                | `PLANNED`                                    |
| Pickup time           | `2026-10-03T06:30:00.000Z`                   |
| Planned delivery time | `2026-10-03T08:30:00.000Z`                   |

The supplier, shipment, quantity and journey times are synthetic fixture
assumptions. `plannedRoute: ['A1']` records motorway intent only. It is not
route geometry, an entry/exit sequence, a carriageway selection, or proof that
the route uses the warning's affected section.

The provider start timestamp falls within the fixture's pickup and planned
delivery bounds. This does not establish a time overlap at the affected
section: the provider response has no event end timestamp, and the fixture has
no route geometry or segment arrival times. Direction text and nearby geometry
also require later deterministic validation before any impact conclusion.

No disruption is persisted or linked to `SHP-002` in CP2.2. Provider mapping,
route matching and impact assessment remain outside this checkpoint.
