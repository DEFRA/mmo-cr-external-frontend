import Boom from '@hapi/boom'

import { config } from '#/config/config.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import { createMapStatisticalAreasReferenceDataClient } from '#/server/common/clients/map-statistical-areas-reference-data.js'

const CACHE_CONTROL = 'public, max-age=3600, stale-while-revalidate=86400'
const client = createMapStatisticalAreasReferenceDataClient({
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

function respond(h, request, result, body) {
  if (matchesIfNoneMatch(result.etag, request.headers['if-none-match'])) {
    return h
      .response()
      .code(statusCodes.notModified)
      .header('ETag', result.etag)
      .header('Cache-Control', CACHE_CONTROL)
  }
  return h
    .response(body)
    .type('application/geo+json')
    .header('ETag', result.etag)
    .header('Cache-Control', CACHE_CONTROL)
}

export const mapStatisticalAreasCollectionController = {
  async handler(request, h) {
    try {
      const result = await client.getCollection(request.query)
      return respond(h, request, result, result.body)
    } catch {
      throw Boom.serverUnavailable(
        'Statistical areas reference data is temporarily unavailable'
      )
    }
  }
}

export const mapStatisticalAreaItemController = {
  async handler(request, h) {
    try {
      const result = await client.getFeature(request.params.id)
      return respond(h, request, result, result.feature)
    } catch (error) {
      if (error.output?.statusCode === statusCodes.notFound) {
        throw error
      }
      if (error.statusCode === statusCodes.notFound) {
        throw Boom.notFound(error.message)
      }
      throw Boom.serverUnavailable(
        'Statistical area reference data is temporarily unavailable'
      )
    }
  }
}
