# Web Service

Next.js presentation layer for LieferRadar.

## Responsibilities

- Render operator-facing shipment, vehicle, disruption and assessment state.
- Communicate with the NestJS API only.
- Keep authoritative logistics and disruption logic in the API.
- Never communicate directly with the Python AI service.

## UI

- Use TypeScript.
- Use Tailwind CSS.
- Use shadcn/ui for reusable UI primitives.
- Prefer simple components and straightforward React state.
- Use native fetch unless a stronger requirement appears.
- Do not introduce additional UI/state libraries without justification.

## Domain boundaries

The frontend must not independently calculate:

- disruption proximity;
- route position;
- direction compatibility;
- timing compatibility;
- disruption eligibility;
- AI evidence.

Render authoritative results returned by NestJS.

## Maps

Leaflet is the preferred library if interactive map functionality is introduced later.

Maps are presentation only. Geographic/domain calculations remain backend-owned.

## Development

Keep changes minimal and readable.

Do not introduce dashboard abstractions, generalized design systems, or infrastructure before they are needed.
