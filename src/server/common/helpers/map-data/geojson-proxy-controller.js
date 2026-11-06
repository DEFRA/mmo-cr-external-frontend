import Boom from '@hapi/boom'

import { statusCodes } from '#/server/common/constants/status-codes.js'

const CACHE_CONTROL = 'public, max-age=3600, stale-while-revalidate=86400'

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

// Same-origin proxy for a Reference Data GeoJSON map layer, keeping the bearer token server-side.
export function createGeoJsonProxyController({
  loadLayer,
  unavailableMessage
}) {
  return {
    async handler(request, h) {
      let result
      try {
        result = await loadLayer()
      } catch {
        throw Boom.serverUnavailable(unavailableMessage)
      }

      if (matchesIfNoneMatch(result.etag, request.headers['if-none-match'])) {
        return h
          .response()
          .code(statusCodes.notModified)
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
}
