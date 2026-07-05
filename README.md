# DoloPaws

Dolomites trail guide, scored for dog safety — terrain, shade, water access, and exposure, not just distance and difficulty.

Live at https://www.dolopaws.com

## Dolomites hiking trails data pipeline (OSM/Overpass)

This repository includes a Node.js pipeline that fetches hiking route data from OpenStreetMap via the public Overpass API, focused on:

- Lombardy (`IT-25`)
- Veneto (`IT-34`)
- Friuli Venezia Giulia (`IT-36`)
- Trentino-Alto Adige/Südtirol (`IT-32`)

### Commands

```bash
npm run fetch:dolomites-trails
npm run validate:dolomites-trails
# or both:
npm run build:dolomites-trails
```

Generated output:

- `/home/runner/work/dolopaws/dolopaws/data/dolomites-trails.json`

The output is a deterministic, compact JSON subset with normalized trail fields used by the static frontend.

## What the project stores

The repository stores a derived subset of OSM trail data for website rendering, including:

- stable trail IDs (`way/...` or `relation/...`)
- name/reference metadata when present
- optional difficulty (`sac_scale`) when tagged
- compact center coordinates and sampled geometry
- selected source tags needed for traceability

## Attribution and license notes (practical, non-legal)

- Data source: OpenStreetMap contributors, queried via Overpass API.
- Required attribution is shown in the website UI where this dataset is displayed.
- OpenStreetMap data is available under the Open Database License (ODbL) 1.0:
  - https://www.openstreetmap.org/copyright
  - https://opendatacommons.org/licenses/odbl/
- If you redistribute OSM-derived databases, review ODbL obligations (including attribution and share-alike conditions where applicable).

This section is practical guidance only and is not legal advice.

## Architecture summary and tradeoffs

- **Pipeline script**: `scripts/fetch-dolomites-trails.js`
  - Uses direct Overpass queries (no private API dependency).
  - Includes retries, request timeout, and readable logs.
  - Keeps dependencies minimal (built-in Node APIs only).
- **Validation script**: `scripts/validate-dolomites-trails.js`
  - Checks the generated JSON schema basics before publish.
- **Frontend integration**: `dolomites-trails.js` + `browse-trails.html`
  - Loads `/data/dolomites-trails.json` at runtime.
  - Renders a simple list and map overlay.
  - Fails gracefully when data is empty or unavailable.

Tradeoff: geometry is sampled to keep the tracked JSON compact and fast to load, while preserving enough shape detail for lightweight visualization.
