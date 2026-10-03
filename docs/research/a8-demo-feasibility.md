# A8 demo feasibility and proposed contracts

Investigated on **2026-10-02**. This is a design document, not Phase B implementation. It extends [Autobahn discovery](autobahn-api.md) and informs [Iteration 002](../iterations/002-autobahn-integration.md). No routing response or shipment match was fabricated.

## Outcome and prerequisites

The demo is one shipment, SHP-001, from Stuttgart to Munich via the A8. Reliable live collection and replay are feasible with the existing real Autobahn fixtures. A geographically verified shipment-impact demo is not established yet.

The current shipment has city names and `plannedRoute: ['A8']`, but no pickup/destination coordinates or route LineString. Its journey is `2026-10-05T08:00:00.000Z` to `2026-10-05T14:00:00.000Z`. See [shipment fixtures](../../services/api/src/logistics/repository/in-memory-logistics.repository.ts). The saved traffic captures are from October 2, not October 5.

No nonempty `ORS_API_KEY`, `OPENROUTESERVICE_API_KEY` or `OPEN_ROUTE_SERVICE_API_KEY` was found in the process environment. No ORS/OpenRoute key declarations were found in local project `.env` files. Credential values were not printed. No saved shipment-route geometry was found. Therefore no authenticated ORS request or route-versus-event proof of concept was run. This does not establish whether the user has a key elsewhere.

## 1. openrouteservice route acquisition

### Request and response

Use an authenticated POST to `https://api.openrouteservice.org/v2/directions/driving-hgv/geojson`. The public service requires an API key; put it in the Authorization header, never in saved request artifacts. The official client uses this base URL and route format. See the [public API](https://api.openrouteservice.org/), [official client configuration](https://github.com/GIScience/openrouteservice-py/blob/master/openrouteservice/client.py), and [authentication documentation](https://openrouteservice.org/dev/).

The [directions return-type documentation](https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/requests-and-return-types) specifies a GeoJSON FeatureCollection: each route feature has a LineString and properties containing summary, segments and waypoint indices. Keep metadata/attribution, engine information, full geometry and the original request alongside any future capture. ORS JSON format uses an encoded polyline; request GeoJSON to avoid that decoding step.

Required request template, **not an executed request**:

```http
POST https://api.openrouteservice.org/v2/directions/driving-hgv/geojson
Authorization: <ORS_API_KEY>
Content-Type: application/json
Accept: application/geo+json, application/json
```

```javascript
// Coordinates must first be chosen from a verified map/source.
// All entries are numeric [longitude, latitude] pairs in travel order.
// These identifiers are placeholders for actual coordinate values.
const body = {
  coordinates: [pickup, ...eastboundA8ViaPoints, destination],
  preference: 'fastest',
  geometry_simplify: false,
  elevation: false,
  instructions: true,
  language: 'de',
  units: 'm',
  extra_info: ['waytype', 'waycategory', 'roadaccessrestrictions'],
  options: { vehicle_type: 'hgv' },
};
// Submit JSON.stringify(body) with the headers above after selecting points.
```

`driving-hgv` is a proposed logistics profile, not proof of a vehicle-specific legal route. The shipment has no truck dimensions, mass, axle load or hazardous-goods data. Do not invent them. ORS supports these restrictions under `options.profile_params.restrictions`; supply them only when verified. `driving-car` could be used for a clearly labeled passenger-car geometry experiment, but is not interchangeable with an approved truck route. See [routing options](https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/routing-options).

### Following the A8

1. Choose precise pickup and delivery coordinates. City centres are a possible explicit demo assumption, not known warehouse locations.
2. Select ordered via points **on the eastbound A8 carriageway**, away from junction ramps: after the chosen Stuttgart entry, along the Ulm/Günzburg corridor, near Augsburg and before the chosen Munich exit. Verify actual coordinates on a map; no guessed waypoint numbers are supplied here.
3. Include those points in `coordinates` in the fixed journey order. Do not optimize/reorder them. Do not request motorway avoidance.
4. Inspect the resulting map, geometry, waypoint snaps and instructions for wrong carriageways, ramps, detours or U-turns. Add or adjust via points only as needed. Waypoints constrain passage through points; they do not guarantee uninterrupted A8 usage between points.
5. If snapping is ambiguous, use per-waypoint `radiuses` to constrain the snap search. Optional `bearings` and `continue_straight` require verification against the hosted driving profile: the official client describes `optimized: false` for these controls, while backend annotations differ by profile/version. Do not assume those controls are supported without a real request. See [official directions client](https://github.com/GIScience/openrouteservice-py/blob/master/openrouteservice/directions.py) and [backend request schema](https://github.com/GIScience/openrouteservice/blob/main/ors-api/src/main/java/org/heigit/ors/api/requests/routing/RouteRequest.java).

No reviewed option forces a named motorway for the whole journey. [Custom models](https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/custom-models) are documented as unavailable on the public API. Do not add a self-hosted routing server for this investigation.

The published [API restrictions](https://openrouteservice.org/restrictions/) allow up to 50 waypoints and 6,000 km for ordinary driving requests; avoid-area routes are limited to 150 km and alternative-route requests to 100 km. A normal Stuttgart–Munich request is plausible within the ordinary limits, but its actual length, response and account quota are unverified. Do not try to force this corridor with large avoidance polygons or alternatives.

### Geometric suitability and limits

Both sources can represent lines in longitude/latitude order. GeoJSON uses WGS84 decimal degrees ([RFC 7946](https://www.rfc-editor.org/rfc/rfc7946.html#section-3.1.1)); the saved Autobahn LineStrings use the same apparent order. Thus an ORS line is a suitable **input** for comparison after bounds/type validation. Shared format does not guarantee coincident road edges, equal map versions or correct carriageway attribution.

Keep unsimplified geometry and travel ordering. Distances must be calculated geodesically or in a suitable metre-based projection, not by treating latitude/longitude degrees as metres. A later disposable experiment should report segment proximity and overlap at several explicitly experimental tolerances, with direction/road evidence; literal line intersection will miss offset representations, while a broad buffer will include adjacent carriageways and ramps. No production tolerance is chosen here.

ORS extras can provide way type/category, restrictions and geometry-index spans. They do not by themselves prove an A8 road reference. The hosted profile table does not advertise `osmid` for driving-car or driving-hgv; do not depend on OSM way IDs being returned. Instructions may help inspection but are not guaranteed canonical road/carriageway IDs. See [extra-info documentation](https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/extra-info/).

Do not use routing duration as a live traffic forecast. The provider states that its hosted service has no live traffic data ([provider response](https://ask.openrouteservice.org/t/isochrone-trafic-data/7875)). ORS route generation time, graph date and the shipment journey time are separate facts.

## 2. Saved-event geographic audit

Audited all saved `a8-*.json` list subsets and details. There are **nine distinct identifiers**; five details repeat list events and must not count as additional disruptions. All nine have nondegenerate LineStrings with two or more distinct vertices. No Point geometry or large area geometry was observed; named `coordinate` is an additional single-point anchor.

Lengths below were calculated from the actual saved vertices, summing haversine distances with Earth radius 6,371,008.8 m and rounding to the nearest metre. They are geometric approximations, not provider-certified affected lengths. Array positions are zero-based. The table's route assessments are geographic/textual inferences for a normal west-to-east A8 journey, **not measured matches to a captured route**.

| Saved event / exact fixture reference | Vertices | Line length | Assessment for the proposed journey |
| --- | ---: | ---: | --- |
| Pforzheim B10 access; `a8-closure-list.json[0]`, also detail-with-start | 6 | 99 m | West of the intended Stuttgart departure; describes B10 access, not the eastbound A8 main carriageway. Negative control under the stated journey assumption. |
| Mühlhausen access; `a8-closure-list.json[1]`, also detail-without-start | 5 | 44 m | In the Stuttgart–Munich corridor, but specifically an **entry ramp** from Gruibingen. Can test geographic proximity; cannot establish impact on a shipment already on the main carriageway. |
| Sauerlach closure; `a8-closure-list.json[2]` | 6 | 279 m | Description identifies A995, despite the A8 title. South of the usual western Munich arrival; road/title false-positive control. Exact destination still matters. |
| Leonberg multi-window closure; `a8-closure-multiple-windows.json[0]` | 36 | 1,144 m | Description identifies A81 Stuttgart–Heilbronn, travelling north/west. Usually outside the eastbound journey, but pickup access routing must be checked. Nearby-road false-positive control. |
| Moseltal/Schengen roadworks; `a8-roadworks-list.json[0]`, also detail-with-start | 2 | 27 m | Far western A8, Saarlouis–Luxembourg. Negative control; a two-point line represents a very short section, not a point. |
| Dachau/Fürstenfeldbruck roadworks; `a8-roadworks-list.json[1]`, also detail-without-start | 2 | 114 m | Along the western approach to Munich, but an **exit ramp** from Fuchsberg. Candidate for proximity testing, not proven main-carriageway impact. |
| Sauerlach roadworks; `a8-roadworks-list.json[2]` | 6 | 291 m | A995 entry ramp; should not match solely because it was collected from the A8 feed. |
| Prien–Bernau traffic; `a8-warning-list.json[0]`, also warning detail | 27 | 1,526 m | A larger section east of Munich toward Salzburg; outside the intended arrival. |
| Bernau–Prien traffic; `a8-warning-without-speed.json[0]` | 31 | 2,980 m | Larger section east of Munich travelling toward Munich. Useful directional contrast, but **not** a demonstrated reverse-carriageway pair on the demo route. |

Fixtures: [Autobahn directory](fixtures/autobahn/) and [capture manifest](fixtures/autobahn/manifest.json). All nine can technically be compared with a future route line. Only the Mühlhausen and Dachau examples are clear corridor-adjacent candidates based on location/text, and both are ramps. Others primarily provide rejection cases. None is a verified positive main-carriageway disruption on the demo route.

### False positives and additional evidence

- **Ramps:** proximity to the A8 does not mean the shipment uses the affected entry/exit. Retain access/exit classifications and restriction text; later compare actual entry/exit segments.
- **Nearby/crossing roads:** geometry can cross or lie near the route without sharing a directed road edge. A8 feed membership and title tokens are insufficient; descriptions here explicitly mention B10, A81 and A995.
- **Opposite carriageways:** close parallel lines can fall within the same tolerance. Use route travel order, local segment headings, reliable road/carriageway IDs if available and provider direction text. Event vertex order is not yet a verified direction contract; treating it as decisive would be an assumption.
- **Short lines:** a 27 m or 44 m geometry may mark a localized restriction, not the complete work area. Do not extrapolate from an anchor point to an entire road.
- **Sparse/offset map representations:** two-point lines, simplified paths and different source maps can cause both missed overlap and excessive buffering. A metre tolerance needs measurement after route capture.
- **Time:** replay preserves source dates. Mühlhausen's description specifies October 15/16, and the Dachau ramp window starts October 5 at 22:00 local text time. Neither establishes overlap with SHP-001's October 5 daytime journey. Structured starts are missing for both. Free-text timezone interpretation and recurrence remain unverified.

Most useful additions: verified origin/destination, chosen A8 entry/exit, ordered carriageway geometry, route segment road references and ramp roles, routing profile/map version, and later segment entry/exit timing estimates with their assumptions. Pickup/delivery bounds alone cannot establish when the shipment reaches a particular restriction. None of these should be added to existing shipment behavior in Phase B.

Once a real route is available, a disposable experiment can compare every unique event, measure minimum segment distance and buffered overlap length, inspect local direction and map each result for review. It must include ramp/other-road/far-away controls, retain `unknown` where evidence is insufficient, and report tolerance sensitivity. It must remain outside application modules and must not authorize or update shipment state.

## 3. Proposed TypeScript contracts

These declarations are proposals only; no `.ts` source files are added. Types containing `string` timestamps require runtime validation. UTC application timestamps use ISO strings ending in `Z`; raw provider timestamp strings retain their original offsets. `?` means absent is allowed, while `null` explicitly means unavailable. Preserve absent versus null inside the provider boundary; use explicit nulls in application-owned projections.

### Validated provider records (integration boundary only)

```typescript
type UtcInstant = string;
type LonLat = readonly [longitude: number, latitude: number];
type Category = 'closures' | 'warnings' | 'roadworks';

interface LineStringGeometry {
  type: 'LineString';
  coordinates: readonly LonLat[];
}

interface ValidatedAutobahnRecord {
  [key: string]: unknown; // Zod passthrough; never consumed as domain fields.
  identifier: string; // Required, nonempty opaque value.
  display_type: string; // Required; unknown category values remain valid strings.
  title: string;
  description: string[];
  subtitle?: string | null;
  icon?: string | null;
  coordinate?: {
    [key: string]: unknown;
    lat: number | string;
    long: number | string;
  } | null;
  geometry?: (LineStringGeometry & Record<string, unknown>) | null;
  startTimestamp?: string | null;
  future?: boolean | null;
  isBlocked?: string | null;
  abnormalTrafficType?: string | null;
  delayTimeValue?: string | null;
  averageSpeed?: string | null;
  source?: string | null;
  point?: string | null;
  extent?: string | null;
  startLcPosition?: string | null;
  impact?: {
    [key: string]: unknown;
    symbols: string[];
    lower?: string | null;
    upper?: string | null;
  } | null;
  routeRecommendation?: unknown[] | null;
  footer?: unknown[] | null;
  lorryParkingFeatureIcons?: unknown[] | null;
}

type ValidatedAutobahnEnvelope =
  | ({ closure: ValidatedAutobahnRecord[] } & Record<string, unknown>)
  | ({ warning: ValidatedAutobahnRecord[] } & Record<string, unknown>)
  | ({ roadworks: ValidatedAutobahnRecord[] } & Record<string, unknown>);
```

Select the envelope schema by the requested category; a warning key must not satisfy a closure request. Validate finite numeric coordinates (including strictly parsed numeric strings) and longitude/latitude bounds. A LineString needs at least two finite positions and nonzero spatial extent. Accept observed offset/Z timestamps and the documented historical `+0200` format only after calendar/offset validation. Geometry/timing are optional; their absence cannot invalidate an otherwise collectable record. Present malformed known fields fail that category; do not silently drop items. No schema defaults to an empty envelope. Use passthrough for envelope, record and relevant nested objects; unfamiliar fields are retained inside the integration, not promoted into business facts.

### Application-owned disruption evidence

```typescript
type Acquisition =
  | { mode: 'live' }
  | {
      mode: 'replay';
      datasetId: string;
      fixtureFile: string; // Catalog-owned relative path, never arbitrary input.
      fixtureSha256: string; // Hash of saved file bytes, not the original full list.
      sample: boolean;
      captureDate: string | null; // Original date-only manifest value, if present.
    };

interface AutobahnProvenance {
  provider: 'autobahn';
  providerId: string;
  category: Category;
  requestedRoadId: string; // Feed requested; not proof of the affected road.
  sourcePath: string;
  acquisition: Acquisition;
  capturedAt: UtcInstant | null; // Original client capture time, if recorded.
  loadedAt: UtcInstant; // Current live/replay execution time.
  providerResponseAt: UtcInstant | null; // HTTP Date, not event update time.
  providerUpdatedAt: UtcInstant | null; // Null unless explicitly verified upstream.
  rawStartTimestamp: string | null;
  upstreamSource: string | null; // E.g. inrix; distinct from provider above.
}

interface DisruptionRecord {
  id: string; // Namespaced composite of provider/feed/category/providerId.
  collectionRunId: string;
  kind: 'closure' | 'traffic-warning' | 'roadworks' | 'unknown';
  reportedType: string; // Keep CLOSURE_ENTRY_EXIT / unfamiliar types verbatim.
  title: string;
  description: readonly string[]; // Contains the original schedule text.
  location: {
    point: LonLat | null; // From named coordinate, never parsed raw `point`.
    line: LineStringGeometry | null;
    directionText: string | null;
  };
  timing: {
    reportedStartAt: UtcInstant | null; // Parsed structured start only.
    reportedEndAt: UtcInstant | null; // Null for all currently captured records.
  };
  providerHints: {
    scheduledInFuture: boolean | null;
    blockingIndicator: string | null; // Preserve ambiguity; not a boolean fact.
    trafficType: string | null;
    averageSpeedText: string | null;
    delayText: string | null;
  };
  source: AutobahnProvenance;
}
```

This record is an application-owned evidence projection, not an established ShipmentImpact. `kind` follows an explicit observed-type mapping; unrecognized types map to `unknown` without losing `reportedType`. No severity, closure certainty, inferred end time, canonical affected road or recommended action is asserted. Source/provider metadata such as lane symbols and ambiguous extent can remain in the validated record for inspection; raw provider objects do not enter the logistics domain. Phase B needs only this projection and collection contracts; it does not add domain persistence or new disruption endpoints.

The composite ID is an inspection/correlation key, not a promise of cross-category or long-term deduplication. Preserve original provider IDs. Unknown fields remain in validated records during collection; detailed HTTP responses need not publish those unknown fields or raw provider payloads.

The existing manifest records a date-only `capturedOn` and provider HTTP Date headers, not precise client capture instants. For these fixtures, preserve `captureDate: '2026-10-02'` and the original `providerResponseAt`, leaving `capturedAt: null`. Do not silently relabel an HTTP Date as a client capture time or an event update time. Future captures should record the client capture instant explicitly.

### Future shipment route geometry (not implemented in Iteration 002)

```typescript
interface ShipmentRouteGeometry {
  id: string; // Identifies one captured/versioned route.
  shipmentId: string;
  crs: 'EPSG:4326';
  geometry: LineStringGeometry; // Ordered pickup -> destination; no reversal.
  waypoints: readonly LonLat[]; // Verified pickup, via points, delivery.
  plannedRoadIds: readonly string[]; // Intent, e.g. A8; not matching evidence.
  journey: { pickupAt: UtcInstant; plannedDeliveryAt: UtcInstant };
  source: {
    provider: 'openrouteservice';
    profile: 'driving-hgv' | 'driving-car';
    capturedAt: UtcInstant;
    providerGeneratedAt: UtcInstant | null;
    engineVersion: string | null;
    graphDate: string | null; // Original metadata format; no guessed timestamp.
    requestSha256: string; // Sanitized reproducible request, excluding key.
    responseSha256: string;
    attribution: string | null;
  };
  segments?: readonly {
    fromVertex: number;
    toVertex: number;
    roadRef: string | null;
    role: 'main-carriageway' | 'entry-ramp' | 'exit-ramp' | 'other' | 'unknown';
    expectedEntryAt?: UtcInstant;
    expectedExitAt?: UtcInstant;
  }[];
}
```

Optional segment labels/timing require separate verified evidence and documented assumptions; ORS does not guarantee all these fields. Do not populate them from imagined road references or line length alone. Validate waypoint/vertex indices, journey ordering and attribution metadata when a real response is available. Keep existing `Shipment.plannedRoute` unchanged in Phase B; this contract describes a future separate route snapshot.

### Future shipment-disruption result (not implemented in Iteration 002)

```typescript
interface ShipmentDisruptionMatch {
  shipmentId: string;
  routeId: string;
  disruptionId: string;
  collectionRunId: string;
  evaluatedAt: UtcInstant;
  algorithmVersion: string;
  status: 'candidate' | 'excluded' | 'indeterminate';
  spatial: {
    relation: 'near-or-overlapping' | 'outside' | 'unknown';
    toleranceMeters: number;
    minimumDistanceMeters: number | null;
    overlapLengthMeters: number | null;
    routeSegmentIndices: readonly number[];
  };
  direction: 'same' | 'opposite' | 'unknown';
  temporal: 'overlap' | 'outside' | 'unknown';
  reasons: readonly string[];
}
```

Keep spatial, directional and temporal evidence separate. Proximity plus missing timing yields uncertainty, not confirmed impact. Missing route geometry or event validity means `unknown`/`indeterminate`; verified spatial exclusion can exclude without resolving timing. Record the tolerance and algorithm version so an experimental result is reproducible. A result must not mutate shipment state or assert a quantified delay or AI confidence score.

### Collection runs and response views (Phase B proposal)

```typescript
type CollectionSource =
  | { mode: 'live' }
  | { mode: 'replay'; datasetId: string };

interface CollectionError {
  code:
    | 'network' | 'timeout' | 'rate-limited' | 'upstream-http'
    | 'invalid-json' | 'invalid-schema' | 'unexpected-response'
    | 'budget-exhausted' | 'cancelled' | 'fixture-unavailable'
    | 'fixture-integrity';
  message: string; // Safe diagnostic; no secrets or machine-specific paths.
}

interface CategoryDiagnostics {
  startedAt: UtcInstant;
  completedAt: UtcInstant;
  durationMs: number;
  httpAttempts: number; // Zero during replay, not one fictitious HTTP request.
  upstreamHttpStatus: number | null; // Null during replay.
  capturedAt: UtcInstant | null; // Original snapshot time, not replay time.
  providerResponseAt: UtcInstant | null; // Historical HTTP Date allowed in replay.
  fixtureFile?: string;
  fixtureSha256?: string;
  sample: boolean; // True for existing sampled list fixtures; no invented totals.
}

type CategoryOutcome = CategoryDiagnostics & (
  | { status: 'success'; count: number; error: null }
  | { status: 'failed'; count: null; error: CollectionError }
);

interface CollectionRun {
  id: string;
  roadId: string;
  source: CollectionSource;
  startedAt: UtcInstant;
  completedAt: UtcInstant;
  status: 'complete' | 'partial' | 'failed';
  categories: Record<Category, CategoryOutcome>;
}

type AutobahnCollectionResponse =
  | { view: 'summary'; run: CollectionRun }
  | {
      view: 'detailed';
      run: CollectionRun;
      disruptions: Record<Category, readonly DisruptionRecord[] | null>;
    };
```

All three categories are required in run metadata. Detailed arrays are empty only after a successful empty envelope and null on failure. Summary counts are the number of validated records loaded, not original full-feed counts for sampled replay. `complete` means every selected category succeeded; it does not mean the replay dataset covers the full A8 or is current. Compute durations from a monotonic clock; use UTC wall time for timestamps. The run ID is a diagnostic identifier, not a database record or background job.

## 4. Phase B design changes

### Module and acquisition boundaries

Keep one module under `services/api/src/integrations/autobahn/`, with `AutobahnClient`, `AutobahnCollectionService`, `AutobahnController`, Zod provider schemas and response DTOs. Add only a small injectable `AutobahnFixtureSource` and a fixed dataset catalog for replay. Use ordinary constructor injection. No generic source interface, plugin system, repository or routing module is needed.

The client returns live JSON plus transport diagnostics; the fixture source returns unchanged captured JSON plus capture provenance. Both feed **one category-specific validation function/schema and one mapping path**, owned by the integration. Replay must not bypass schemas or supply pre-normalized invented disruptions. Concurrent category acquisition preserves each result even if another fails. Client retry behavior remains HTTP-specific; fixture file/schema errors are terminal.

Proposed checked-in replay catalog entry: `a8-phase-a-2026-10-02`, road `A8`, using the existing closure list (3 events), warning list (1 event) and roadworks list (3 events). Preserve the manifest's capture date and each individual provider Date header; precise client capture times are unknown. Label this as a **representative sampled collection dataset**, not a complete or positive-impact scenario. Supplemental/detail fixtures remain useful offline test inputs; do not concatenate details as new events.

The catalog must allowlist paths and carry actual saved-file hashes and available original date/time provenance, explicitly marking unknown client capture instants. Existing manifest hashes of full upstream lists are different from subset-file hashes: do not compare the latter to the former. Unknown dataset/road combinations fail before any file/provider access; no arbitrary file paths, URLs or client uploads. Ensure Phase B packaging copies/locates the checked-in catalog fixtures in the built application and verifies replay after build, independent of the working directory. Do not implement packaging or edit fixtures during this investigation.

### Development HTTP endpoint

Keep `GET /integrations/autobahn/:roadId` with validated queries:

- `mode=live|replay`, default `live`.
- `view=summary|detailed`, default `summary`.
- `dataset=<allowlisted-id>`, required only for replay and rejected for live.

Examples: `/integrations/autobahn/A8?mode=live&view=summary` and `/integrations/autobahn/A8?mode=replay&dataset=a8-phase-a-2026-10-02&view=detailed`.

Both views execute identical acquisition/validation/mapping. Summary reduces response volume only; it is not a separate cheap validation path. No shipment ID input, route lookup or impact filtering. A detailed response contains the evidence records above, including geometry/description/provenance; summary includes counts and all category diagnostics/errors. Never fall back silently from live to replay.

| Outcome | Proposed HTTP policy |
| --- | --- |
| All categories succeed, including legitimate empty arrays | 200 |
| Some categories fail, in either mode | 502, explicit partial run and all outcomes |
| Every live category fails only due to timeout/budget | 504 |
| All live categories fail for other/mixed provider failures | 502 |
| All replay categories fail due to server-owned files/integrity/schema | 500 with safe fixture diagnostics |
| Invalid road/query/dataset/road-dataset combination | 400, no acquisition |
| Development endpoint disabled | Route not registered |

This distinguishes input mistakes from server packaging/fixture problems. Preserve successfully acquired categories in a partial response. Retain unknown road-existence behavior for live syntactically valid IDs; list success is not existence validation. Default production-disabled endpoint registration needs explicit configuration; do not add a new authentication system here.

### Reliability and replay time

Retain three total HTTP attempts, 8 s per-attempt timeout and a shared 20 s collection deadline as **proposed configurable defaults**, not observed SLA. Full jitter after failed attempt n is uniform in `[0, min(2 s, 250 ms * 2^(n-1))]`. Retry eligible transient network failures, timeouts, 429 and 500/502/503/504; ordinary 4xx, 501/505, invalid JSON/schema and cancellation are terminal. Classify HTTP errors before parsing success bodies. Valid `Retry-After` sets a minimum wait; if it exceeds remaining budget, stop rather than retry early. Abort active requests at the deadline. See the [original retry investigation](autobahn-api.md#proposed-bounded-http-retry-strategy).

Replay makes zero HTTP requests and never invokes HTTP backoff. Preserve provider timestamps and original capture provenance. New run/loaded timestamps describe replay execution, not fresh upstream observation. Do not shift event dates to today's date or alter the shipment journey. If a later demo needs historical matching, explicitly choose a recorded scenario time and a separate agreed journey snapshot; that decision is outside Phase B.

## 5. Questions remaining before implementation

1. **Route capture:** supply an ORS key or a real captured route, and choose exact pickup/delivery coordinates and A8 entry/exit. Is a generic HGV profile acceptable until vehicle attributes exist? This blocks route acquisition, not collection/replay design.
2. **Positive-impact demo:** current sampled fixtures establish collection and negative/ramp cases. Which real main-carriageway event will serve as the positive scenario, and at what historical journey time? Further real capture/selection is needed; do not modify the existing records to force a match.
3. **Response/retry policy:** confirm summary as default, detailed evidence shape, partial 502, replay packaging failure 500, and 3/8 s/20 s retry defaults. These are proposed decisions for Phase B.
4. **Replay packaging/access:** agree the fixed catalog and production-disabled development endpoint. Keep dataset selection explicit and preserve historical timestamps.
5. **Matching evidence:** route/event map alignment, metre tolerance, carriageway direction and free-text schedules remain unverified. No matching threshold or confirmed temporal interval can be finalized without actual route and interval evidence.

Phase B may begin only after reviewing this design. It remains limited to live/replay collection, validation, evidence projection and development responses. No database, scheduler, production matching, routing integration, AI integration or changes to Iteration 001 behavior are proposed for implementation.
