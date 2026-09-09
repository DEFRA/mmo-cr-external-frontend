# GitHub Copilot Prompt: Step 12A Offline Map Data Preprocessing

Implement the iOS offline fisheries-map approach for the existing web Statistical Area journey.

The web implementation must:

- use `map.geojson`, `subrectangles.geojson`, and `ports.geojson` as build inputs;
- accept numeric strings and recover invalid WGS84 coordinates as EPSG:3857 Web Mercator;
- skip malformed geometry locally rather than discarding a full layer;
- derive each subrectangle label from its own bounding-box centre;
- calculate `overlapsSea` with the iOS 5 by 5 sample-grid algorithm;
- emit browser-ready local data assets at build time;
- use a Canvas map without map tiles, geocoding, or external map/network services;
- retain ports as display-only and make only sea-overlapping subrectangles selectable;
- use viewport extents based on the selected departure port's nearest four rectangles at maximum
  zoom-in, nine at the default extent, and sixteen at maximum zoom-out, while retaining every
  rectangle in the dataset;
- preserve the existing Step 12 route and Other-branch behaviour.

Use an ADR for source ownership, generated artifacts, and no-network rendering. Test coordinate
recovery, geometry resilience, sea-overlap behavior, generated feature counts, and route validation.
