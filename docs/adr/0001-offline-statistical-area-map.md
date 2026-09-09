# 0001: Offline Statistical Area Map

## Status

Accepted

## Decision

The web frontend keeps a versioned source snapshot of the iOS land, subrectangle, and port GeoJSON
files. A deterministic Node script normalizes these inputs and produces checked-in browser assets
plus a server-side subrectangle-code allowlist.

The map is a Canvas enhancement of the existing Statistical Area route. It loads only local assets
and makes no tile, geocoding, font, image, or map-service request.

## Consequences

- The map works with network access blocked.
- The source snapshot must be refreshed deliberately when the iOS source changes.
- Coordinate recovery and sea-overlap work occur at build time rather than browser runtime.