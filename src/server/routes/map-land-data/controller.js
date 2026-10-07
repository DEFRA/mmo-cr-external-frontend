import Boom from '@hapi/boom'

import { config } from '#/config/config.js'
import { createMapLandReferenceDataClient } from '#/server/common/clients/map-land-reference-data.js'

const CACHE_CONTROL = 'public, max-age=3600, stale-while-revalidate=86400'
const client = createMapLandReferenceDataClient({
  serviceUrl: config.get('referenceData.serviceUrl'),
  token: () => config.get('referenceData.token'),
  timeoutMs: config.get('referenceData.timeoutMs')
})

function matchesIfNoneMatch(etag, header) {
  return Boolean(
    etag &&
    header
      ?.split(',')
      .some(
        (candidate) => candidate.trim() === '*' || candidate.trim() === etag
      )
  )
}

export const mapLandDataController = {
  async handler(request, h) {
    let result
    try {
      result = await client.getLand()
    } catch {
      throw Boom.serverUnavailable(
        'Map land reference data is temporarily unavailable'
      )
    }

    if (matchesIfNoneMatch(result.etag, request.headers['if-none-match'])) {
      return h
        .response()
        .code(304)
        .header('ETag', result.etag)
        .header('Cache-Control', CACHE_CONTROL)
    }

    return h
      .response(result.body)
      .type('application/geo+json')
      .header('ETag', result.etag)
      .header('Cache-Control', CACHE_CONTROL)
  }
}
