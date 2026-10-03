# Autobahn API discovery — Iteration 002, Phase A

## Scope and sources

Research performed on **2026-10-02**. Only this document and research fixtures were added. No client, module, route, scheduler, persistence, shipment matching or AI behavior was implemented.

Provider base: `https://verkehr.autobahn.de/o/autobahn`.

Sources:

- [Published bundesAPI OpenAPI specification, version 1.0.1](https://github.com/bundesAPI/autobahn-api/blob/e3c62d87685e5de169184603ec5e4577a15dc0d3/openapi.yaml). This is a community-maintained specification; its contact metadata does not establish that it is a current operator-authored contract. The latest commit affecting that file returned by GitHub was `e3c62d87685e5de169184603ec5e4577a15dc0d3`, dated 2023-05-26.
- [Specification repository and endpoint inventory](https://github.com/bundesAPI/autobahn-api).
- Actual responses from [A8 closures](https://verkehr.autobahn.de/o/autobahn/A8/services/closure), [A8 warnings](https://verkehr.autobahn.de/o/autobahn/A8/services/warning), [A8 roadworks](https://verkehr.autobahn.de/o/autobahn/A8/services/roadworks), the corresponding detail endpoints, and the [road directory](https://verkehr.autobahn.de/o/autobahn/).

The live observations below take precedence over assumptions based solely on specification examples. Snapshots establish response shape at capture time, not current traffic conditions or shipment impact.

**Design follow-up:** [A8 demo feasibility and contracts](a8-demo-feasibility.md) adds routing research, measured fixture geometry, live/replay modes and summary/detailed responses. Its collection response proposal supersedes the initial response shape below; the recorded Phase A observations and original fixtures remain unchanged. The [Iteration 002 plan](../iterations/002-autobahn-integration.md) now incorporates that proposal for review before implementation.

## Observed list responses

All three requests returned HTTP 200 with `application/json; charset=utf-8`. No authorization header or API key was supplied.

| Endpoint | JSON envelope | Records | Structured start present | Provider Date header (UTC) |
| --- | --- | ---: | ---: | --- |
| `/A8/services/closure` | `{"closure": [...]}` | 29 | 5/29 | 2026-10-02 08:33:17 |
| `/A8/services/warning` | `{"warning": [...]}` | 6 | 6/6 | 2026-10-02 08:33:26 |
| `/A8/services/roadworks` | `{"roadworks": [...]}` | 118 | 62/118 | 2026-10-02 08:33:28 |

These are category-specific objects, not bare arrays. There is no pagination, total count, road identifier, generated-at timestamp or next-page field in these captured envelopes. Local record counts were calculated from arrays. The three requests do not represent an atomic snapshot.

Observed display types:

- Closures: `CLOSURE`, `CLOSURE_ENTRY_EXIT`.
- Warnings: `WARNING`; observed `abnormalTrafficType` values include `SLOW_TRAFFIC` and `QUEUING_TRAFFIC`.
- Roadworks: `ROADWORKS`, `SHORT_TERM_ROADWORKS`.

The specification also lists `WEIGHT_LIMIT_35` among event display types; it was not observed in this A8 sample. Preserve unfamiliar type values rather than equating every closure-feed item with a complete main-carriageway closure.

## Relevant fields and their limits

| Provider field | Live shape and observations | Relevance to LieferRadar / collection decision |
| --- | --- | --- |
| `identifier` | Nonempty opaque strings such as `INRIX--vi-avl.2026-10-02_07-52-00-000_011.de0` and long project/phase identifiers. Not base64 in these responses. | Preserve verbatim for source attribution and later update/deduplication investigation. Do not decode, parse timestamps out of it, or assume stability across updates/categories. URL-encode the entire value for detail requests. |
| `display_type`, `icon` | Strings. Icons include `250`, `448`, `101`, `123`, `warnkegel`. | Retain provider classification and distinguish entrance/exit restrictions from full closures. Icons are hints, not deterministic impact or severity rules. |
| `title` | Strings containing road names, section labels or a project name. | Human-readable road/section evidence. Not a canonical structured road identifier. |
| `subtitle` | Direction/ramp text; sometimes empty, with leading whitespace in examples. | Useful for later direction matching. Preserve text; do not infer compass direction or shipment relevance now. |
| `description` | Array of strings, including empty separator lines. | Primary evidence for restrictions, construction phases, schedules, length and maximum passage width. Retain ordering and content. Collection should not interpret these as verified application rules. |
| `coordinate.lat`, `coordinate.long` | Numbers in every captured list event. Detail samples also use numbers. | Explicit named WGS84 coordinates are preferable to interpreting unlabelled text tuples. Later matching will need segment geometry, not just a single point. |
| `geometry` | Observed `{"type":"LineString","coordinates":[[longitude,latitude],...]}`. Present throughout the three captured lists. | Valuable later for affected-road geometry. Retain the full selected geometry; no route intersection calculation in this iteration. It is absent from the reviewed specification. |
| `point` | String whose first value equals latitude and second equals longitude in captured records. | Conflicts with the published longitude/latitude description. Preserve raw text for diagnostics; do not use it to derive coordinates. |
| `extent` | Four comma-separated values. Selected examples match start/end latitude/longitude pairs, sometimes descending. | The specification calls this a bounding rectangle, but the live representation is ambiguous. Preserve raw; do not assume longitude-first ordering or min/max bounds. |
| `startTimestamp` | Optional in lists, explicitly null in some details. Offset timestamps or UTC `Z`. | Preserve the reported timestamp and missing state. It is not a collection timestamp, expiry time or complete validity interval. |
| `future` | Boolean; both true and false occur in closure/roadworks samples. | Provider scheduling hint. Does not replace an interval, prove current activity or establish shipment overlap. |
| `isBlocked` | String `"false"` in all three captured lists, even items classified as closures. | Semantics unresolved. Never use JavaScript truthiness or interpret this as authoritative road accessibility. |
| `impact` | Object for closure/roadworks, omitted in warning lists and null in sampled warning detail. `symbols` array; optional `lower`/`upper` section labels. | Preserve lane-diagram/section evidence. It is provider metadata, not LieferRadar's future ShipmentImpact. No lane-count or severity rules should be derived yet. |
| `startLcPosition` | String values such as `"1"`, `"43"`, `"1000"`. | Meaning/units undocumented in reviewed spec. Retain internally; do not treat as distance, chainage or junction ID. |
| `abnormalTrafficType` | Warning strings; null in sampled closure/roadworks details. | Traffic subtype evidence. Allow unknown future values. |
| `delayTimeValue`, `averageSpeed` | Warning strings, sometimes absent; null for sampled non-warning details. The initial warning snapshot had delay in 5/6 and speed in 4/6 events. | Selected warning descriptions associate these with minutes and km/h, respectively. Preserve reported strings; no universal unit/validity contract established. Missing is not zero. |
| `source` | `"inrix"` on warnings; null on sampled closure/roadworks details and omitted from their lists. | Additional source attribution. Keep separate from provider `autobahn`. |
| `routeRecommendation`, `footer`, `lorryParkingFeatureIcons` | Empty arrays in saved selected events. | Low current priority. Preserve as optional provider data if retained; no rerouting functionality is implied. |

The provider's `impact` field and a future internal impact assessment must remain distinct. Collection facts must not become inferred risk or shipment state.

## Location and time evidence for the shipment scenario

An A8 collection covers far more than Stuttgart–Munich. Captured examples include Saarlouis–Luxembourg, Pforzheim and Munich–Salzburg. It also contains descriptions of A81, A995 and B10 ramps, sometimes with an A8 title. A road feed membership or the substring `A8` alone cannot prove impact on SHP-001. Spatial extent, direction, affected ramp/road and temporal evidence will matter in a later iteration.

There is no structured end timestamp in any captured list or sampled detail record. The relevant observed start formats are:

- `2026-01-16T05:00:00+01:00`;
- `2026-08-25T06:00:00+02:00`;
- `2026-10-02T07:52:00Z`.

The published examples additionally show the historical format `2021-06-29T09:00:00.000+0200`; that format was not observed live here.

Schedules in descriptions use German date/time text, two-digit years, multiple windows, recurring weekdays and `24:00`. A saved closure example contains three windows and refers separately to the end of the overall construction project. Another sampled closure contains a current phase start and an end in 2027. These are different concepts; the overall project end must not be substituted for a particular closure interval.

Warning text can mix a local-looking time with an unlabeled UTC-looking time: the saved warning has `07:52:00Z`, a “Beginn” line at 09:52, and a “seit” line at 07:52. The offset is explicit only in the structured timestamp. Timezone interpretation of free text remains unverified.

**Phase B recommendation:** retain source strings and nullable reported start values. Do not invent `endTimestamp`, manufacture a continuous interval from recurring text, or introduce time parsing/impact matching in collection.

## Detail endpoint findings

Correct reviewed paths are:

- `/details/closure/{identifier}`;
- `/details/warning/{identifier}`;
- `/details/roadworks/{identifier}`.

Detail responses are single event objects without category envelopes. Five live detail responses were saved: closures with/without a start timestamp, one warning and roadworks with/without a start timestamp.

Compared with matching list samples, details add explicit nulls for absent fields such as `startTimestamp`, `delayTimeValue`, `averageSpeed`, `abnormalTrafficType`, `source` or `impact`. They did not add an end timestamp or materially better location/schedule information.

Recommendation: collect the three list endpoints only in Phase B. Do not add one detail request per event. This avoids unnecessary fan-out without losing information demonstrated in these samples. Detail enrichment can be revisited only if a concrete missing field is shown to be available there.

## Empty, error and unexpected-response findings

| Probe | Observed result | Consequence |
| --- | --- | --- |
| Known road `A861`, closure list | HTTP 200, `{"closure":[]}` | A successful empty collection is distinct from failure. |
| Nonexistent road `A999999`, closure list | HTTP 200, `{"closure":[]}` | Provider success does not verify road existence. Do not claim an empty response proves “no disruptions on a valid road.” |
| Nonexistent closure detail ID | HTTP 200, JSON content type, zero-byte body | HTTP status alone is insufficient. Do not treat a blank body as an empty list or `null` event. |
| A8 three lists and sampled existing details | HTTP 200, valid JSON | No live 429, 5xx or other non-2xx provider error was observed. |

The specification advertises 204/400/404, describes 204 as not found and unusually labels 400 an internal-server error. Those statuses were not observed. No rate limit, retry schedule or reliable freshness SLA was established from these requests. No load tests or deliberate rate-limit/error triggering were performed.

For collection, require a valid JSON envelope and expected array on HTTP 200. Missing array keys, blank/HTML bodies, malformed JSON and invalid required event shapes are failures, not successful empty results. Until provider semantics are confirmed, treat 204 as an unexpected no-content response, not an empty event array. Do not retry malformed/schema-invalid responses.

The sandbox initially blocked DNS resolution and the web reader could not render the A8 lists. Live observations were obtained with approved direct HTTP access; those local tooling failures are not Autobahn error responses.

## Saved fixtures and provenance

All artifacts are under [fixtures/autobahn](fixtures/autobahn/). [manifest.json](fixtures/autobahn/manifest.json) records request paths, provider Date headers, counts, original list byte counts/SHA-256 hashes, field presence/type observations and selected IDs.

- `a8-closure-list.json`: three unchanged events covering optional start, absent start and A995/A8 disagreement.
- `a8-warning-list.json`: unchanged warning with UTC start, speed/delay strings and geometry.
- `a8-roadworks-list.json`: three unchanged events covering normal/short-term work, passage-width text, absent start and A995 evidence.
- `a8-*-detail-*.json`: five complete single-event detail bodies, including explicit nulls.
- `a8-closure-multiple-windows.json`: separate observed subset with multiple windows and `24:00`.
- `a8-warning-without-speed.json`: separate observed subset with no `averageSpeed`.
- `a861-closure-empty.json` and `unknown-road-closure-empty.json`: complete observed empty-list bodies.
- `missing-closure-detail.http.json`: transport fixture with status/content type and `bodyText: ""`. This wrapper is our fixture format; the actual HTTP body was zero bytes, not a JSON object or JSON empty string.

List arrays were reduced to representative subsets. Event keys, values, absent fields, numeric types, strings and complete selected geometries were preserved. Only public road-event data and allowlisted HTTP metadata were retained; credentials, cookies, personal/account metadata and request headers were excluded. No synthetic provider fields were inserted. Later unit tests must use saved fixtures; retry failures such as 429/503 should be constructed and labeled as simulated tests, not asserted as observed behavior.

## Proposed NestJS structure — review only

Use one feature under `services/api/src/integrations/autobahn/`:

```text
autobahn.module.ts
autobahn.client.ts
autobahn.collection.service.ts
autobahn.controller.ts
dto/
  autobahn-provider.schema.ts
  autobahn-collection-response.dto.ts
```

- `AutobahnModule` registers and exports `AutobahnCollectionService`, and owns client/controller providers.
- `AutobahnClient` owns HTTP transport, runtime provider validation and bounded retries. Use built-in Node fetch/AbortController and existing Zod. No Axios, new HTTP library or generated SDK is required.
- `AutobahnCollectionService` collects the three categories independently and concurrently with one collection deadline; it records failures instead of failing fast and hiding other outcomes. It maps provider values to an explicit integration response DTO.
- `AutobahnController` validates the requested road and converts collection outcomes to HTTP responses. It does not depend on shipment services.
- Provider Zod schemas and inferred types stay inside the integration. Nothing is added to `src/logistics/model/`. No Disruption/ShipmentImpact domain model is introduced during reliable collection.
- Use normal constructor injection for providers. For deterministic retry tests, inject clock/randomness/sleep/transport through a small client-options provider or equivalent narrowly scoped seam; do not introduce a generic resilience framework.

Validation proposal: require the correct envelope array and nonempty `identifier`, string `display_type`/`title`, and string-array `description` for collected events. Treat observed auxiliary fields as optional, accepting null where details demonstrate it. Accept numeric coordinates and finite numeric strings from the historical specification, without replacing the original provider values internally. Allow additional keys and unfamiliar string categories. Missing optional facts remain missing; never default a missing array/envelope to empty. Present but invalid known fields should yield explicit schema failure rather than silently dropping events.

The development endpoint remains `GET /integrations/autobahn/:roadId`. A development-enable setting should gate registration; default disabled for production. Deployment protection remains a review decision, without adding users/authentication in this iteration.

## Proposed collection response and HTTP policy

An application-owned DTO should contain:

- `roadId`, `startedAt`, `collectedAt` (UTC collector times, not provider update times);
- `status: "complete" | "partial" | "failed"`;
- `collections.closures`, `collections.warnings`, `collections.roadworks`;
- per category, a discriminated success or failure result.

Success: `status: "success"`, `events: CollectedAutobahnEventDto[]`, `error: null`, and diagnostics such as attempts, duration and upstream HTTP status. An empty events array explicitly means successful retrieval. Failure: `status: "failed"`, `events: null`, a typed error code/message and the same available diagnostics. A failed collection must not be represented as `events: []`.

The event projection should expose the verified source evidence needed for inspection: `providerId`, `displayType`, `title`, ordered `description`, `directionText`, named coordinates, line geometry, nullable `reportedStartTimestamp`, provider scheduling/blocking hints, source and optional traffic strings. If retained in the response, unverified point/extent/lane-diagram text must be explicitly labeled as provider metadata. This is a collection DTO; it has no derived severity, shipment ID, impact, inferred end time or recommended action. Preserve the validated provider record inside the integration boundary; do not make application/domain services consume it.

Proposed HTTP outcomes:

| Outcome | HTTP status |
| --- | --- |
| All three categories succeed, including empty arrays | 200 |
| At least one succeeds and at least one fails | 502 with the complete partial-result body |
| All fail and all are timeout/budget exhaustion | 504 with all failure details |
| All fail for other/mixed provider failures | 502 with all failure details |
| Invalid local road syntax | 400 before provider calls |
| Development endpoint disabled | Route not registered |

Do not convert ordinary provider 4xx into a misleading local shipment/road 404. Road existence is not verified by these list calls. For a minimal motorway-only endpoint, validate a bounded identifier form supporting `A8`, `A64a` and `A99a`, then encode it as a path component. Do not accept arbitrary paths/URLs. A directory lookup/allowlist should be added only if reviewed road-existence validation is required.

## Proposed bounded HTTP retry strategy

These are proposed defaults for review, not measured provider guarantees:

- Maximum **3 attempts total** per category, including the first.
- Per-attempt timeout **8 seconds**, covering headers, body reading and JSON handling.
- One **20-second collection deadline** shared by concurrently started category calls, covering attempts and waits. Each attempt receives `min(8s, remaining budget)`; abort active requests at the deadline.
- Backoff base **250 ms**, cap **2 seconds**. After failed attempt `n` (first failure `n=1`), full-jitter delay is `random[0, min(2s, 250ms * 2^(n-1))]`.
- Retry timeouts, connection resets, temporary DNS/connect failures, 429 and transient 500/502/503/504. Classify invalid URLs/configuration, certificate failures, cancellation and exhausted budgets as terminal. Do not retry ordinary 4xx, 501/505, malformed JSON or schema failures.
- Parse `Retry-After` as nonnegative integer seconds or a valid HTTP date, as defined by [RFC 9110, section 10.2.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.3). For 429/eligible 5xx, use at least the valid server delay: `max(jitterDelay, retryAfterDelay)`. Do not cap a server delay down to the backoff cap. If it does not fit the remaining budget, stop with an explicit budget/rate-limit failure rather than retrying early. Ignore malformed values; a valid past date means zero additional server delay.
- Stop when attempts or deadline are exhausted. Preserve attempt count, last HTTP status, elapsed time and terminal failure kind. Treat HTTP status classification before success-body schema validation, so a 503 HTML error can still be retried.
- No automatic retries for parent cancellation and no background retry queue. Avoid accidental unbounded redirect handling; do not follow redirects to an arbitrary origin.
- Log category, road, status, elapsed time and failure class. Do not log credentials, full request headers or full response bodies.

Inject deterministic time/randomness/transport behavior for tests, using Jest fake timers. Keep each category's failure independent while enforcing the shared overall budget.

## Review decisions and unresolved questions

1. **Agree the response/HTTP policy:** confirm 502 for partial results and 504 for total timeout. Successful-empty and failure must remain distinguishable.
2. **Agree timeout/budget defaults:** 8s per attempt, three attempts and 20s overall are starting points; the limited successful probes establish no SLA.
3. **Road existence:** accept provider empty results with existence unverified, or require an additional directory/allowlist check? Recommendation for Phase B: no extra directory call.
4. **Validation contract:** accept documented numeric-string coordinates alongside observed numbers; require minimal identity/content fields, preserve unfamiliar categories and explicit missing optional values.
5. **Provider uncertainties:** no structured end time; free-text timezone/recurrence semantics, `isBlocked`, `startLcPosition`, point/extent ordering and identifier lifecycle are unresolved. None should block raw reliable collection; all matter before deterministic impact matching.
6. **Production access:** confirm how the temporary endpoint is disabled/protected. Recommendation: configuration-gated registration, production disabled.
7. **Details:** sampled detail calls did not fill the important gaps. Recommendation: list collection only; no automatic detail fan-out.
8. **Unobserved failures:** 204/429/5xx behavior and retry-after headers require deterministic simulated tests in Phase B. Do not induce provider load to manufacture research examples.

Phase A completes the discovery checkpoint. Phase B implementation requires review of these proposals.
