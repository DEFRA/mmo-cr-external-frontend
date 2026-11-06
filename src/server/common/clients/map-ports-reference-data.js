import { createMapGeoJsonReferenceDataClient } from './map-geojson-reference-data.js'

export function createMapPortsReferenceDataClient(options = {}) {
  const client = createMapGeoJsonReferenceDataClient({
    ...options,
    endpoint: '/api/v1/reference-data/map/ports',
    dataset: 'map-ports',
    label: 'Map ports'
  })
  return { getPorts: client.getLayer }
}
