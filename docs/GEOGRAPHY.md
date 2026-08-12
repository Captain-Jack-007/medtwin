# Geography & Map Data

**Real geography, synthetic medical data.** MedTwin renders the Navoiy region
(Uzbekistan) on a real-world map. All patient, screening, risk, and dispatch
figures are synthetic hackathon demo data and do **not** correspond to real
residents or any health authority's records.

## Coordinate sources

Coordinates are WGS84 (`latitude`, `longitude`) and are defined in two places
that intentionally agree:

- `src/lib/region.ts` — the safety-critical engine model (`VILLAGES`,
  `CLINICS`). Internal ids (`v-a … v-j`, `clinic-0x`) are stable and drive the
  deterministic dispatch logic and its tests. **Do not rename these ids.**
- `src/data/navoiyLocations.ts` — the geographic **presentation** layer used by
  the Control Tower map. It joins onto the region ids and adds display names and
  coordinates. This file never owns dispatch logic.

Real place coordinates were taken from public sources (OpenStreetMap /
Wikipedia settlement data) and are approximate to the town centre.

| id     | Display name        | Kind            | Latitude | Longitude | Real? |
|--------|---------------------|-----------------|---------:|----------:|-------|
| v-e    | Qiziltepa           | city            | 40.040   | 64.850    | Yes   |
| v-f    | Nurota              | city            | 40.568   | 65.679    | Yes   |
| v-g    | Konimex             | district        | 40.276   | 65.145    | Yes   |
| v-h    | Tomdi               | district        | 41.751   | 64.617    | Yes   |
| v-i    | Uchquduq            | city            | 42.170   | 63.460    | Yes   |
| v-j    | Karmana             | city            | 40.210   | 65.370    | Yes   |
| v-a    | Demo Community A    | demo-community  | 40.310   | 65.470    | No    |
| v-b    | Demo Community B    | demo-community  | 40.020   | 65.010    | No    |
| v-c    | Demo Community C    | demo-community  | 40.360   | 65.560    | No    |
| v-d    | Demo Community D    | demo-community  | 40.680   | 65.520    | No    |

Navoiy city centre (map default framing): `40.104, 65.373`.

### Demo communities

`v-a … v-d` are **synthetic demo communities**, not real settlements. They are
anchored near real district seats so they render plausibly on the map, are
typed `demo-community`, and are labelled as demo/synthetic in the UI. They exist
only to exercise the triage and dispatch demo flow.

## Privacy

The Control Tower shows **aggregate area labels only** (e.g. "Uchquduq"),
never an exact patient residence. The live demo patient (MT-LIVE) is surfaced
against an aggregate area, not a home coordinate.

## Map tiles & attribution

Base map tiles are **OpenStreetMap** raster tiles, configured in
`src/data/mapConfig.ts` (`MAP_TILE_CONFIG`). Attribution
(© OpenStreetMap contributors) is rendered in the Leaflet attribution control
and must remain visible. No Google Maps tiles are used.

If tiles fail to load (e.g. offline), the map falls back to the synthetic SVG
control map (`src/components/NavoiyMap.tsx`).
