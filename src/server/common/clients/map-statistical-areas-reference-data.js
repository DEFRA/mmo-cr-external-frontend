const COLLECTION_PATH = '/api/v1/reference-data/map/statistical-areas'
const DEFAULT_TIMEOUT_MS = 3000
const NOT_MODIFIED_STATUS = 304
const SERVER_ERROR_STATUS = 500

export class MapStatisticalAreasReferenceDataError extends Error {
  constructor(message, statusCode = 503) {
    super(message)
    this.name = 'MapStatisticalAreasReferenceDataError'
    this.statusCode = statusCode
  }
}

function validateFeatureCollection(body) {
  if (
    body?.type !== 'FeatureCollection' ||
    body.metadata?.dataset !== 'map-statistical-areas' ||
    !Array.isArray(body.features)
  ) {
    throw new MapStatisticalAreasReferenceDataError(
      'Statistical areas reference data returned an invalid response'
    )
  }
  return body
}

function validateFeature(feature) {
  if (
    feature?.type !== 'Feature' ||
    typeof feature.id !== 'string' ||
    typeof feature.properties?.code !== 'string' ||
    !feature.geometry
  ) {
    throw new MapStatisticalAreasReferenceDataError(
      'Statistical area reference data returned an invalid response'
    )
  }
  return feature
}

async function requestReferenceData(config, path, etag) {
  const { serviceUrl, token, timeoutMs, fetchFn } = config
  const bearerToken = typeof token === 'function' ? token() : token
  if (!serviceUrl || !bearerToken) {
    throw new MapStatisticalAreasReferenceDataError(
      'Statistical areas reference data is not configured'
    )
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetchFn(`${serviceUrl.replace(/\/$/, '')}${path}`, {
      method: 'GET',
      headers: {
        Accept: 'application/geo+json, application/json',
        Authorization: `Bearer ${bearerToken}`,
        ...(etag ? { 'If-None-Match': etag } : {})
      },
      signal: controller.signal
    })
  } catch {
    throw new MapStatisticalAreasReferenceDataError(
      'Statistical areas reference data is temporarily unavailable'
    )
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchCollection(path, cached, request) {
  const response = await request(path, cached?.etag)
  if (response.status === NOT_MODIFIED_STATUS && cached) {
    return cached
  }
  if (!response.ok) {
    if (cached && response.status >= SERVER_ERROR_STATUS) {
      return cached
    }
    throw new MapStatisticalAreasReferenceDataError(
      'Statistical areas reference data could not be retrieved',
      response.status
    )
  }

  let body
  try {
    body = validateFeatureCollection(await response.json())
  } catch (error) {
    if (error instanceof MapStatisticalAreasReferenceDataError) {
      throw error
    }
    throw new MapStatisticalAreasReferenceDataError(
      'Statistical areas reference data returned an invalid response'
    )
  }
  return { body, etag: response.headers?.get('etag') || undefined }
}

async function getCollection(filters, { collectionCache, inFlight, request }) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value))
    }
  }
  const query = params.toString()
  const path = query ? `${COLLECTION_PATH}?${query}` : COLLECTION_PATH
  if (inFlight.has(path)) {
    return inFlight.get(path)
  }

  const cached = collectionCache.get(path)
  const pending = fetchCollection(path, cached, request)
  inFlight.set(path, pending)
  try {
    const result = await pending
    collectionCache.set(path, result)
    return result
  } finally {
    inFlight.delete(path)
  }
}

async function getFeature(id, { itemCache, request }) {
  const cacheKey = String(id)
  const cached = itemCache.get(cacheKey)
  const response = await request(
    `${COLLECTION_PATH}/${encodeURIComponent(id)}`,
    cached?.etag
  )
  if (response.status === NOT_MODIFIED_STATUS && cached) {
    return cached
  }
  if (!response.ok) {
    if (cached && response.status >= SERVER_ERROR_STATUS) {
      return cached
    }
    throw new MapStatisticalAreasReferenceDataError(
      'Statistical area reference data could not be retrieved',
      response.status
    )
  }

  let feature
  try {
    feature = validateFeature(await response.json())
  } catch (error) {
    if (error instanceof MapStatisticalAreasReferenceDataError) {
      throw error
    }
    throw new MapStatisticalAreasReferenceDataError(
      'Statistical area reference data returned an invalid response'
    )
  }
  const result = { feature, etag: response.headers?.get('etag') || undefined }
  itemCache.set(cacheKey, result)
  return result
}

export function createMapStatisticalAreasReferenceDataClient({
  serviceUrl,
  token,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchFn = (...args) => globalThis.fetch(...args)
} = {}) {
  const collectionCache = new Map()
  const itemCache = new Map()
  const inFlight = new Map()
  const request = (path, etag) =>
    requestReferenceData({ serviceUrl, token, timeoutMs, fetchFn }, path, etag)

  return {
    getCollection: (filters = {}) =>
      getCollection(filters, { collectionCache, inFlight, request }),
    getFeature: (id) => getFeature(id, { itemCache, request })
  }
}
