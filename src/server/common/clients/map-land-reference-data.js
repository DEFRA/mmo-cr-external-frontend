import { createMapGeoJsonReferenceDataClient } from './map-geojson-reference-data.js'

export function createMapLandReferenceDataClient(options = {}) {
  const client = createMapGeoJsonReferenceDataClient({
    ...options,
    endpoint: '/api/v1/reference-data/map/land',
    dataset: 'map-land',
    label: 'Map land'
  })
  return { getLand: client.getLayer }
}
