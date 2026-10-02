# Iteration 001 — Logistics Core

## Goal

Establish the minimum logistics domain required by LieferRadar to represent a shipment moving products from a supplier to a destination.

This iteration provides the verified operational data that later iterations will use for disruption detection and AI-assisted decision making.

No disruption detection or AI functionality is introduced in this iteration.

---

## Business Context

LieferRadar is initially designed for a logistics provider responsible for transporting products from suppliers to customer destinations.

A shipment contains products supplied by a supplier and is transported from a pickup location to a destination using a planned route.

Later iterations will monitor external disruption signals and determine whether they may affect these shipments.

Example future workflow:

Supplier

→ Shipment

→ Planned Route

→ External Disruption

→ Shipment Impact Detection

→ AI Risk Analysis

→ Human Decision

---

## V1 Scenario

The initial development scenario represents a shipment of electronic components from Stuttgart to Munich.

### Supplier

- ID: `SUP-001`
- Name: `Stuttgart Components GmbH`
- Location: Stuttgart, Germany

### Product

- ID: `PROD-001`
- SKU: `ECU-CTRL-01`
- Name: `ECU Controller`

### Shipment

- ID: `SHP-001`
- Supplier: `SUP-001`
- Product: `PROD-001`
- Quantity: `2000`
- Pickup: Stuttgart
- Destination: Munich
- Planned route: `A8`
- Status: `IN_TRANSIT`

The exact pickup and planned delivery timestamps may be chosen as seed/fixture data during implementation.

---

# Domain Model

## Location

`Location` represents a geographic point relevant to logistics operations.

Initial properties:

```ts
interface Location {
  city: string;
  countryCode: string;
  latitude?: number;
  longitude?: number;
}
```

Coordinates are optional in this iteration but are included in the model because later disruption detection may require geographic matching.

`Location` should be reusable for supplier locations, shipment pickup locations, destinations, and future logistics entities.

---

## Supplier

A `Supplier` represents the organization from which a shipment is collected.

Initial properties:

```ts
interface Supplier {
  id: string;
  name: string;
  location: Location;
}
```

A supplier may provide multiple products and participate in multiple shipments.

---

## Product

A `Product` represents goods transported by the logistics provider.

Initial properties:

```ts
interface Product {
  id: string;
  sku: string;
  name: string;
}
```

Product information should remain minimal in this iteration.

Inventory management, pricing, manufacturing information, and ERP-specific product data are outside the current scope.

---

## Shipment

`Shipment` is the central operational entity in LieferRadar.

It represents transportation of a product from a supplier/pickup location to a destination.

Initial properties:

```ts
type ShipmentStatus =
  | "PLANNED"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "DELAYED"
  | "CANCELLED";

interface Shipment {
  id: string;

  supplierId: string;
  productId: string;

  quantity: number;

  pickupLocation: Location;
  destination: Location;

  plannedRoute: string[];

  status: ShipmentStatus;

  pickupAt: Date;
  plannedDeliveryAt: Date;
}
```

`plannedRoute` is intentionally simple in this iteration.

For the initial scenario:

```ts
plannedRoute: ["A8"];
```

Do not introduce a routing engine or detailed road-segment model yet.

Later iterations may evolve route representation when required by disruption matching or rerouting.

---

# Relationships

The initial domain relationship is:

```text
Supplier
   │
   │ supplies
   ▼
Product
   │
   │ transported through
   ▼
Shipment
   │
   ├── pickupLocation
   ├── destination
   └── plannedRoute
```

A shipment references its supplier and product by identifier.

Avoid unnecessarily embedding complete supplier or product objects inside the core shipment model.

API responses may compose related information when useful.

---

# API

The minimum API capability for this iteration is:

```http
GET /shipments/:id
```

Example:

```http
GET /shipments/SHP-001
```

The endpoint should return enough operational context to understand:

- which shipment is being transported;
- which supplier it originates from;
- which product is being transported;
- quantity;
- pickup location;
- destination;
- planned route;
- shipment status;
- pickup and planned delivery timestamps.

The exact HTTP response DTO should be designed at the API boundary and should not require the domain model to match the response structure.

---

# Persistence

Persistent database storage is not required for this iteration.

A fixture-backed or in-memory repository is acceptable.

The repository abstraction should make it possible to replace fixture storage with persistent storage later without changing business services.

Do not introduce additional infrastructure solely for this iteration.

---

# Business Rules

For this iteration:

1. A shipment must reference a known supplier.
2. A shipment must reference a known product.
3. Shipment quantity must be greater than zero.
4. Planned delivery must occur after pickup.
5. A shipment must have a pickup location.
6. A shipment must have a destination.
7. A shipment must have at least one planned route identifier.

Do not introduce additional business rules without a concrete requirement.

---

# Testing

Add focused automated tests for the introduced behavior.

At minimum verify:

- an existing shipment can be retrieved;
- an unknown shipment produces the appropriate not-found behavior;
- the fixture shipment references valid supplier and product data;
- invalid shipment quantities are rejected if shipment construction/validation is introduced;
- invalid pickup/planned-delivery timing is rejected if shipment construction/validation is introduced.

Follow the existing NestJS testing conventions where practical.

Do not require external APIs or the Python AI service for these tests.

---

# Out of Scope

The following are explicitly outside Iteration 001:

- users
- authentication
- authorization
- roles and permissions
- shipment creation API
- shipment modification
- shipment cancellation
- shipment rerouting
- disruption APIs
- Autobahn integration
- NINA integration
- weather integration
- disruption matching
- AI risk analysis
- recommendations
- human approval
- RAG
- inventory
- purchase orders
- warehouses
- payments and refunds

Existing refund functionality should not be removed as part of this iteration.

It may later be reassessed as a downstream capability for approved shipment cancellation and refund workflows.

---

# Acceptance Criteria

Iteration 001 is complete when:

1. `Supplier`, `Product`, `Location`, and `Shipment` are represented in the NestJS service.
2. The Stuttgart → Munich fixture scenario exists.
3. `SHP-001` references `SUP-001` and `PROD-001`.
4. The shipment contains pickup and destination locations.
5. The shipment contains the planned route `A8`.
6. `GET /shipments/SHP-001` returns the shipment and useful operational context.
7. Requesting an unknown shipment returns appropriate not-found behavior.
8. Relevant automated tests pass.
9. Existing refund functionality continues to work.
10. No changes are required in the Python AI service.

---

# Future Direction

Iteration 002 will introduce users, roles, permissions, and authorization around logistics operations.

Later iterations will introduce real-world disruption signals and determine whether those disruptions affect shipments.

The intended progression is:

```text
Logistics Core
      ↓
Users & Authorization
      ↓
External Disruptions
      ↓
Shipment Impact Detection
      ↓
AI Risk Analysis
      ↓
Human Decision
      ↓
Controlled Action Execution
```

The current iteration should not implement functionality belonging to those later stages.
