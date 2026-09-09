# Step 12A Offline Map Data Preprocessing Plan

## Objective

Add a Canvas-based, fully offline statistical-area map that consumes data generated at build time
from the equivalent iOS GeoJSON sources.

## Implementation Plan

1. Version the iOS GeoJSON inputs in `data/offline-map/source`.
2. Generate normalized land, port, and subrectangle assets with Web Mercator recovery and
   precomputed sea-overlap eligibility.
3. Load only local generated data in a Canvas enhancement for the existing Statistical Area route.
4. Validate generated `subCode` values on the server and retain the existing Other branch.
5. Render every rectangle in the current viewport while using nearest four, nine, and sixteen
   rectangles to define the maximum zoom-in, default, and maximum zoom-out extents.

## File/Component Impact

- `scripts/generate-offline-map-data.js` generates browser data and the validation allowlist.
- `src/client/javascripts/modules/statistical-area-map.js` renders and interacts with the map.
- Statistical Area route/template/stylesheets integrate the Canvas and selected area state.

## Validation Plan

- Test coordinate recovery, sea overlap, nearest-area selection, and route validation.
- Run generator, focused tests, linting, and `npm run build:frontend`.

## Risks, Assumptions and Sources

The iOS map data is currently the upstream source. Its subrectangle coordinates are Web Mercator
despite their GeoJSON shape. The iOS `offline-map-overview.md`, geometry converter, and sea-overlap
implementation are the behavior reference.
