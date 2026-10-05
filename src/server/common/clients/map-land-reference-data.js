const MAP_LAND_ENDPOINT = '/api/v1/reference-data/map/land'
const DEFAULT_TIMEOUT_MS = 3000

export class MapLandReferenceDataError extends Error {
  constructor(message, statusCode = 503) {
    super(message)
    this.name = 'MapLandReferenceDataError'
    this.statusCode = statusCode
  }
}

function validateFeatureCollection(body) {
  if (
    body?.type !== 'FeatureCollection' ||
    !Array.isArray(body.features) ||
    body.metadata?.dataset !== 'map-land'
  ) {
    throw new MapLandReferenceDataError(
      'Map land reference data returned an invalid response'
    )
  }
  return body
}

export function createMapLandReferenceDataClient({
  serviceUrl,
  token,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchFn = (...args) => globalThis.fetch(...args)
} = {}) {
  let cached
  let inFlight

  async function getLand() {
    const bearerToken = typeof token === 'function' ? token() : token
    if (!serviceUrl || !bearerToken) {
      throw new MapLandReferenceDataError(
        'Map land reference data is not configured'
      )
    }
    if (inFlight) return inFlight

    inFlight = fetchLand(bearerToken)
    try {
      return await inFlight
    } finally {
      inFlight = undefined
    }
  }

  async function fetchLand(bearerToken) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      let response
      try {
        response = await fetchFn(
          `${serviceUrl.replace(/\/$/, '')}${MAP_LAND_ENDPOINT}`,
          {
            method: 'GET',
            headers: {
              Accept: 'application/geo+json, application/json',
              Authorization: `Bearer ${bearerToken}`,
              ...(cached?.etag ? { 'If-None-Match': cached.etag } : {})
            },
            signal: controller.signal
          }
        )
      } catch {
        if (cached) return cached
        throw new MapLandReferenceDataError(
          'Map land reference data is temporarily unavailable'
        )
      }

      if (response.status === 304) {
        if (!cached) {
          throw new MapLandReferenceDataError(
            'Map land reference data returned an unexpected cache response'
          )
        }
        return cached
      }
      if (!response.ok) {
        if (cached && response.status >= 500) return cached
        throw new MapLandReferenceDataError(
          'Map land reference data could not be retrieved',
          response.status
        )
      }

      let body
      try {
        body = validateFeatureCollection(await response.json())
      } catch (error) {
        if (error instanceof MapLandReferenceDataError) throw error
        throw new MapLandReferenceDataError(
          'Map land reference data returned an invalid response'
        )
      }
      cached = {
        body,
        etag: response.headers?.get('etag') || undefined
      }
      return cached
    } finally {
      clearTimeout(timeout)
    }
  }

  return { getLand }
}
