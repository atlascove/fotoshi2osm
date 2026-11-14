# Fotoshi2OSM

A compact photo-first OSM reviewer, derived from **Adrien Pavie’s Pic4Review**, with Fotoshi imagery and basemaps. AGPL-3.0-or-later.

**App:** https://osm.fotoshi.com/fotoshi2osm/  
**Source:** https://github.com/atlascove/fotoshi2osm

## First version

Select an area and review queue, inspect real Fotoshi photos, and compare them with **live OSM tags**. Review name, opening hours, wheelchair access, website, phone, or another tag. Preview the exact diff, confirm the photographic evidence, and submit one object under your own OpenStreetMap account. Skip uncertain items. Overture attributes are separate suggestions and add source credit only when accepted into the saved diff.

Existing nodes, ways and relations support **tag edits only**. Their geometry, node references, members and version are preserved. Unlinked places open in Fotoshi iD for duplicate checks and adding/linking; there is no bulk import or automatic creation. Stored OSM tags are not presented as fresh evidence. GERS presence does not change the recorded place origin.

The map uses Fotoshi's canonical `mobile-satellite.json` and `mobile-vector.json` styles. Satellite imagery comes from the existing `tiles.fotoshi.com/v1/base-maps/esri-world/{z}/{x}/{y}` source. Source attribution remains on the map. The reviewer removes only the styles' photo coverage overlay, drawing the reviewed geometry and capture locations itself.

## Run

Node 24 or newer recommended.

```sh
npm ci
npm test
npm run build
npm run dev
```

Open http://localhost:8095/fotoshi2osm/. OSM authentication is available on the deployed OSM origin. Data is real; tests mock all writes. No live-map edits are required for QA.

Deep link: `?fid=FSEV1hHoFAuCsga5ex&photo=0bwUrKwuZo7Rh0npG1wsNEfu`. Optional `area=goldau|angra|songdo` and `mission=linked|unlinked|all` select a bounded local queue (up to 36 places from a 3×3 z15 tile neighbourhood). A linked deep target is preserved even if outside the chosen queue.

## Structure

- `src/reviewer/Question.jsx`, `Gallery.jsx`: ported Pic4Review choice/gallery components, with Fotoshi photo attribution and current React-compatible controls.
- `src/reviewer/main.jsx`: bounded queue and review state; no mission backend.
- `data.js`: Fotoshi overlay API adapters and source identities; at most nine z15 tiles and two concurrent requests per area.
- `ReviewMap.jsx`: MapLibre basemap, OSM geometry and photo locations.
- `osm.js`: live object loading, validation, diff, conflict check, XML preservation and one-object changeset lifecycle.
- `auth.js`: OSM OAuth 2.0 with PKCE, isolated session token and existing Fotoshi iD callback.
- `worker.mjs`: `/fotoshi2osm/*` asset routing plus static asset routing only. It never receives OSM tokens and cannot submit map changes.
- `test/`: data identity, XML preservation, no-op/conflict/ambiguous-write/close-failure behavior, and route constraints.

## OSM authorization and upload

Reuses the existing Fotoshi iD **public OAuth client ID**, requesting `read_prefs write_api` with S256 PKCE. The registered callback remains `https://osm.fotoshi.com/land.html`; its existing BroadcastChannel forwards the callback only on the same origin. The reviewer validates the exact callback path, origin and random state. No client secret is used. Its access token is session-only under a reviewer-specific key, separate from iD's localStorage. Signing out of the reviewer does not sign out of iD. No callback or iD code is changed.

Before saving, fetch the live object again and reject a changed version. Each save opens a changeset, updates the single original object, then closes the changeset. Empty diffs are rejected. Uploads never automatically retry. An ambiguous network outcome shows the changeset link so the mapper can inspect before retrying. A failed close after a successful object update is reported as saved with a warning.

Changeset metadata: `created_by=Fotoshi2OSM 0.1`, a mapper-editable comment, `source=streetlevel imagery;fotoshi`, `imagery_used=Fotoshi`, and `Overture Maps` in source when a changed tag was explicitly accepted from Overture. No invented hashtags or object metadata are added automatically.

## Source and licence

Upstream: https://framagit.org/Pic4Carto/Pic4Review (Adrien Pavie / Pic4Review contributors, AGPL). This repository was imported from the actual Fotoshi/Pic4Review fork in `atlascove/atlascove.github.io`, branch `feature/fotoshi2osm-labs`, on 2026-11-14. The initial Git commit preserves the complete imported prototype source. Subsequent commits port the question/gallery workflow and remove unused legacy frontend/backend modules and dependencies. Original upstream documentation is under `docs/`.

The hosted derivative and its corresponding source are AGPL-3.0-or-later: see [LICENSE](LICENSE). Photographer licences and OSM/ODbL attribution are independent. Fotoshi's existing outlined logo artwork is reused; no Sifonn font binary is distributed. Dependencies retain their respective licences (see `dist/app.js.LEGAL.txt` and MapLibre's distribution header).

Related: [FOT-998](https://linear.app/fotoshi/issue/FOT-998), [FOT-1002](https://linear.app/fotoshi/issue/FOT-1002). This is a small first implementation, not completion of all proposed mission, enrichment, telemetry or website-entry-point work in those issues.

The overlay payload does not currently expose `created_source` consistently. Origin is shown as unknown when absent; a GERS ID is never used to infer Overture origin. This version makes no website browse-session or telemetry requests.

## Deployment

The separate Cloudflare Pages project is `fotoshi2osm` (production branch `main`). `fotoshi2osm-editor` routes only `osm.fotoshi.com/fotoshi2osm*` to its assets. The root iD deployment, its callback, and the earlier Labs experiment are unchanged.

With `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` supplied securely by your deployment environment, run `npm run deploy`. The script builds with the commit SHA, deploys Pages using the same pinned CLI workflow as iD, uploads the path-only worker, and checks route ownership before binding it. No secrets belong in this repository. GitHub Actions currently runs tests, the production build and dependency audit; production deployment is explicit.
