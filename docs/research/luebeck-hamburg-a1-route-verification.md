# Lübeck–Hamburg A1 route verification

**Status:** B1 evidence recorded on 2026-10-04<br>
**Purpose:** Verify the supplied static route for the Iteration 003 simulated corridor without claiming a real shipment was affected.

## Artifacts

- Route: [`luebeck-hamburg-a1.geojson`](../../services/api/test/fixtures/routes/luebeck-hamburg-a1.geojson)
- Warning source: [`a1-warnings-2026-10.03.json`](../../services/api/test/fixtures/autobahn/a1-warnings-2026-10.03.json)
- Reproducible verifier: [`verify-luebeck-hamburg-a1-route.js`](../../services/api/scripts/verify-luebeck-hamburg-a1-route.js)

The route SHA-256 is `ecd9ff4cb5c273041800dec3912bacbd5c856f7a8a522c9f63ed3477d0ee2a2a`.
It is one GeoJSON `LineString` with 644 finite WGS84 coordinates. The saved ORS
metadata reports `driving-car`, 68,242.2 metres, 3,434.4 seconds, capture time
`2026-10-04T06:47:53.593Z`, and attribution `openrouteservice.org | OpenStreetMap contributors`.
The verifier independently calculates 68,242.31 metres from its segments. The
route starts at `[10.686606, 53.865509]` in Lübeck and ends at
`[10.000857, 53.550633]` in Hamburg.

## Warning and comparison

The selected authentic provider record is
`INRIX--vi-avl.2026-10-03_06-53-00-000_003.de0`: an A1 warning between
Bargteheide and Ahrensburg with the provider direction `Lübeck -> Hamburg`.
Its recorded start is `2026-10-03T06:53:00Z`; the provider response omits its
end. This is historical warning evidence, while the shipment and vehicle are
fictional and the route was captured later.

The planned synthetic simulation window is `2026-10-03T06:30:00Z` through
`2026-10-03T08:30:00Z`, so the warning's recorded start falls within that
window. Its omitted end means timing is only a candidate signal: it does not
establish duration, a temporal overlap, or actual impact.

The verifier samples each warning segment at intervals no greater than 25
metres. It computes segment length using Haversine distance and finds the
nearest route point using a local equirectangular point-to-segment projection
at each sample latitude. This is a reproducible corridor check, not a
carriageway, legal-route or traffic reconstruction.

| Control | Result | Interpretation |
| ------- | ------ | -------------- |
| Selected warning | 104 samples; 0.000–0.663 m from route; 100% within 25 m; route distance 36,535.00–38,855.49 m | The saved route follows this warning geometry in the stated Lübeck-to-Hamburg travel order. |
| Opposite-direction warning `..._007.de0` | 15.788–19.007 m from route; route distance 34,306.56 to 27,947.39 m | Nearby geometry alone does not establish compatible direction. |
| Unrelated A1 warning `INRIX--vi-unf.2026-10-03_02-13-28-000_001.de0` | Minimum 253,779.217 m from route | Negative control for the corridor calculation. |

The selected result supports using the route as a conservative candidate in the
demo. It does **not** establish that a real vehicle, an HGV, or `SHP-002` was
affected: the export is passenger-car geometry, its capture followed the
historical warning, and geometry cannot identify the carriageway, ramps,
traffic state or a missing warning end time.

## Reproduction

From the repository root:

```bash
node services/api/scripts/verify-luebeck-hamburg-a1-route.js
shasum -a 256 services/api/test/fixtures/routes/luebeck-hamburg-a1.geojson
node -e 'const fs=require("node:fs"); const r=JSON.parse(fs.readFileSync("services/api/test/fixtures/routes/luebeck-hamburg-a1.geojson","utf8")); const f=r.features[0]; if(r.type!=="FeatureCollection" || r.features.length!==1 || f.geometry.type!=="LineString" || f.geometry.coordinates.length!==644) throw new Error("unexpected route shape"); console.log({summary:f.properties.summary, metadata:r.metadata});'
```

## Required later demo preparation behavior

B3 must replay and then query the exact selected record with source `autobahn`,
the provider ID above and `ingestionMode: REPLAY`. If newer LIVE state prevents
that replay record from being available, preparation must fail visibly. It must
not substitute the current LIVE warning or another provider record.
