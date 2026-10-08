import Boom from '@hapi/boom'

import { config } from '#/config/config.js'
import { createVesselsReferenceDataClient } from '#/server/common/clients/vessels-reference-data.js'

const client = createVesselsReferenceDataClient({
  serviceUrl: config.get('referenceData.serviceUrl'),
  token: () => config.get('referenceData.token'),
  timeoutMs: config.get('referenceData.timeoutMs')
})

export async function getVesselCatalogue() {
  try {
    return await client.getVessels()
  } catch {
    throw Boom.serverUnavailable(
      'Vessels reference data is temporarily unavailable'
    )
  }
}

export async function getVesselItem(id) {
  try {
    return await client.getVessel(id)
  } catch {
    throw Boom.serverUnavailable(
      'Vessels reference data is temporarily unavailable'
    )
  }
}
