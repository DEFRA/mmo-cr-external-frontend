import { config } from '#/config/config.js'
import { createMapLandReferenceDataClient } from '#/server/common/clients/map-land-reference-data.js'
import { createGeoJsonProxyController } from '#/server/common/helpers/map-data/geojson-proxy-controller.js'

const client = createMapLandReferenceDataClient({
  serviceUrl: config.get('referenceData.serviceUrl'),
  token: () => config.get('referenceData.token'),
  timeoutMs: config.get('referenceData.timeoutMs')
})

export const mapLandDataController = createGeoJsonProxyController({
  loadLayer: () => client.getLand(),
  unavailableMessage: 'Map land reference data is temporarily unavailable'
})
