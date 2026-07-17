# DoloPaws trail verification — internal reference

How a trail earns `curated: true`, and what "checked" means per hazard.
Companion to `SCORING.md` (how the trail is scored once verified) and
`trail-trust.js` (how the unverified/verified distinction is worded to the
owner). Keep this in sync with `scripts/promote-osm-trails.js` and the
`PROMOTED_RELATIONS` comments in that file — this doc is the process,
that file's comments are the audit trail.

## The graduation rule

**An imported trail graduates to verified only after all ten checks pass:**
photo/licensing, route geometry, map-point coordinates, elevation, and every
one of the six hazard categories below. At graduation set `curated: true`,
retain the original `source: 'osm'` provenance, set
`graduation.status: 'verified'`, and record all ten completed checks.

**Every safety category must be checked against at least one citable source
that is not merely an absence of OSM tags.** OSM data (via
`promote-osm-trails.js`) is what makes a trail importable and walkable on
the map at all — distance, elevation, computed terrain rank, matched water
points. It is never, by itself, what makes a trail *verified*, because OSM
has no dog-specific tagging (no `leash=*`, no `sac_scale` for most of this
region — see below) and mapped absence of a hazard is not evidence the
hazard is absent. `trail-trust.js` already encodes this: an imported trail
is worded as "not field reviewed" even when its OSM-derived fields are
fully populated.

A trail can also stay `curated: false` and still be *enriched* with cited
facts (see `osm-14987412` / "Sentier du Four" in `trails-data.js` — leash
and livestock facts sourced from Decathlon Outdoor and the Haute-Savoie
department fiche, but no citable source for dog access, so it stays
imported). Enrichment and full curation are different bars: enrichment
needs one citable source per fact you add; curation needs every hazard
category below resolved.

## Source hierarchy — what counts as citable

| Source | Counts as citable for... | Never sufficient alone for... |
|---|---|---|
| OSM tags (`sac_scale`, `surface`, `leash`) | Terrain/surface baseline, orientation | Exposure, livestock, heat/shade, dog access — OSM is rarely dog-specific and "not tagged" ≠ "not present" |
| Official/regional portal (park authority, tourism board, department fiche — the `website` field on imported trails) | Any fact the source states explicitly and specifically (e.g. "dogs on leash, cattle graze June–Sept") | Anything the source doesn't mention — silence isn't clearance |
| Recent, dated, specific trip reports (Waymarked Trails talk, AllTrails/Komoot comments, forums) | Corroborating or overriding a stale official source, especially for conditions that change season to season (water flow, livestock presence, washed-out sections) | A single report older than ~2 years, or one that doesn't name the specific hazard |
| Your own field visit | Everything — a field visit resolves all categories at once and is the only source that can positively confirm shade/exposure conditions no document states | — |

Rule of thumb: if the only source for a fact is OSM, write it as unverified
(current behavior for imported trails). If you have one non-OSM citable
source per hazard category, `curated: true` is defensible. If you have
none, leave it `curated: false` even if OSM made the trail look complete.

## Per-hazard checklist

Same categories `trail-trust.js` already renders (`waterAssessment`,
`heatAssessment`, `exposureAssessment`, `livestockAssessment`), plus surface
hazards and dog access, which aren't currently individually broken out.

- **Water** — is there a mapped point, and does a portal or recent report
  confirm it actually flows (not just appears on the map)? If not, leave
  `waterSources` as-is but do not claim it's verified.
- **Heat & shade** — does a source describe canopy/exposure (forest vs open
  ridge), not just the season? `shadeCoverage` should reflect what a source
  says, not a guess from elevation.
- **Exposure** — does a source explicitly rule out unprotected drop-offs or
  via ferrata-style sections? Silence here defaults to `exposure: undefined`
  (treated as unknown, per `trail-trust.js`), never to `false`.
- **Livestock** — does a source mention grazing, guardian/patou dogs, or
  cattle on or near the route, in-season? This is the single most common
  reason a Haute-Savoie alpage route needs a leash warning even when the
  terrain itself is easy.
- **Surface hazards** — do the OSM `surfaces` percentages (rock/mud/scree
  share) match the stored `terrainRank` and `surfaceHazards`? This one *can*
  be partly checked from already-fetched OSM data — see the script below —
  but a mismatch only tells you to go look, not what to write.
- **Dog access / leash rules** — is there an explicit rule (leash required,
  seasonal restriction, banned outright)? A protected-area or no-dogs
  finding is a **removal**, not a downgrade — see the `BANNED`/`REMOVED`
  entries in `PROMOTED_RELATIONS` in `scripts/promote-osm-trails.js`.

## Tracking progress: the `verified` field

Prose comments (`// Facts from Decathlon Outdoor...`) are the human-readable
record, but nothing can query them — there's no way to ask "which trails
still need their livestock check?" without re-reading every comment. Each
trail entry can carry a small structured field alongside the comment so
progress is machine-readable and survives across sessions:

```js
"verified": {
  "categories": ["livestock", "surfaceHazards"],  // subset of the 6 below, checked against a non-OSM source
  "sources": ["Decathlon Outdoor — Chemin des Fours", "Dept. Haute-Savoie fiche"],
  "date": "2026-07-14"
}
```

The six canonical category names (match the checklist above and the keys
`check-trail-sources.js` reports on): `water`, `heat`, `exposure`,
`livestock`, `surfaceHazards`, `access`.

- Absent `verified` field = no category-by-category source review is recorded.
- `categories` only ever grows via real verification work — never add a
  category you didn't actually check against a listed source.
- `source` records how the trail entered the catalogue. `curated: false` means
  it has not graduated; `curated: true` means it passed the full standard.
  Only a record with all six safety categories and all four presentation/data
  checks may be described to visitors as verified.
- Add `reviewedAt`, `reviewedBy`, and route-specific `sourceLinks` so the
  visitor can inspect the dated review record rather than seeing a generic
  list of data providers.
- The prose comment and the `verified` field should agree — write both in
  the same edit, the comment for a human skimming the file, the field for
  the script.

## Tracking graduation: the `graduation` field

`verified.categories` records the six safety checks. `graduation` combines
those with the four presentation/data checks required before an imported trail
can become verified:

```js
graduation: {
  status: 'in-progress',
  required: ['photo','route','mapPoints','elevation','water','heat','exposure','livestock','surfaceHazards','access'],
  completed: ['photo','route','mapPoints','elevation'],
  blockers: {
    water: 'Mapped locations exist, but current flow is not confirmed.'
  }
}
```

- A check enters `completed` only when its evidence and source are recorded.
- `blockers` must explain why each unresolved check cannot yet pass.
- `status: 'verified'` is valid only when all ten required checks are complete.
- Until then the trail remains `curated: false` and its rating remains an
  estimate, even if its route line and headline facts are correct.
- No-source-found is a blocker, not a successful check.

## Procedure

1. Run `npm run check:trail-sources` (see below) to get a worklist of
   imported trails, each with its OSM surface cross-check, its official
   portal / Waymarked Trails links, and its verification progress
   (`categories` already checked vs. still missing) — this replaces
   manually hunting for each trail's OSM relation, website, and prior notes.
2. For each trail, open the official portal link and search recent trip
   reports for the hazard categories still missing. Note what each source
   actually says (or doesn't).
3. Fill in only what a source supports. Leave the rest unknown — an
   unverified field beats a guessed one.
4. Validate photo rights, geometry, exact waypoint coordinates and elevation;
   record those four checks in `graduation.completed` only when they pass.
5. Add newly-resolved safety category names to `verified.categories`, the
   source(s) to `verified.sources`, and today's date — plus the matching
   dated prose comment above the entry.
6. Mirror every supported safety category in `graduation.completed`. If all
   ten checks pass, set `graduation.status: 'verified'` and `curated: true`.
   Otherwise keep the trail imported and list the blockers.
7. If a source rules the route out for dogs (protected area, mandatory
   off-leash zone, alpine-grade terrain), remove it from `trails-data.js`
   and add its relation ID to `PROMOTED_RELATIONS` with a `BANNED`/`REMOVED`
   comment so the importer never re-adds it.

## `scripts/check-trail-sources.js`

Cross-references `trails-data.js` + the imported (`osm-trails*-data.js`)
trails against the raw OSM properties already fetched into
`dog-friendly-routes*.geojson` (`surfaces`, `website`, `waymarkedtrails`,
`sac_scale`, `leash`, `dogFriendlyNotes`). It does not call any external
API — everything it reports was already pulled by `fetch-dolomites-trails.js`
/ `fetch-dog-friendly-routes.js`. It flags:

- surface data that disagrees with the stored `terrainRank`/`surfaceHazards`,
- trails with no official portal link at all (harder to verify — plan on a
  trip report or field visit instead),
- OSM `leash`/`dogFriendlyNotes`/`sac_scale` tags that exist but aren't
  reflected in the trail entry, in case a re-fetch has picked up tagging
  that wasn't there before,
- verification progress from the `verified` field: which of the six
  categories are already checked and which remain, so you can pick a trail
  back up without re-reading its whole history.

It does not and cannot check exposure, heat/shade, or livestock — those
have no reliable OSM tagging in this region and stay a manual, source-cited
judgment call per the checklist above.

```
npm run check:trail-sources                # imported trails only, all regions
npm run check:trail-sources -- --id osm-123162
npm run check:trail-sources -- --include-curated   # sanity-check curated trails too
```
