import { config } from '#/config/config.js'
import { createMapPortsReferenceDataClient } from '#/server/common/clients/map-ports-reference-data.js'
import { createGeoJsonProxyController } from '#/server/common/helpers/map-data/geojson-proxy-controller.js'

const client = createMapPortsReferenceDataClient({
  serviceUrl: config.get('referenceData.serviceUrl'),
  token: () => config.get('referenceData.token'),
  timeoutMs: config.get('referenceData.timeoutMs')
})

export const mapPortsDataController = createGeoJsonProxyController({
  loadLayer: () => client.getPorts(),
  unavailableMessage: 'Map ports reference data is temporarily unavailable'
})
