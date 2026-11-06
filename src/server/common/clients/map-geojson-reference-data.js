const DEFAULT_TIMEOUT_MS = 3000
const NOT_MODIFIED_STATUS = 304
const SERVER_ERROR_STATUS = 500

export class MapReferenceDataError extends Error {
  constructor(message, statusCode = 503) {
    super(message)
    this.name = 'MapReferenceDataError'
    this.statusCode = statusCode
  }
}

function validateFeatureCollection(body, dataset, label) {
  if (
    body?.type !== 'FeatureCollection' ||
    !Array.isArray(body.features) ||
    body.metadata?.dataset !== dataset
  ) {
    throw new MapReferenceDataError(
      `${label} reference data returned an invalid response`
    )
  }
  return body
}

async function requestLayer({ url, bearerToken, timeoutMs, fetchFn, cached }) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetchFn(url, {
      method: 'GET',
      headers: {
        Accept: 'application/geo+json, application/json',
        Authorization: `Bearer ${bearerToken}`,
        ...(cached?.etag ? { 'If-None-Match': cached.etag } : {})
      },
      signal: controller.signal
    })
  } finally {
    clearTimeout(timeout)
  }
}

async function readLayer(response, dataset, label) {
  try {
    return validateFeatureCollection(await response.json(), dataset, label)
  } catch (error) {
    if (error instanceof MapReferenceDataError) {
      throw error
    }
    throw new MapReferenceDataError(
      `${label} reference data returned an invalid response`
    )
  }
}

async function fetchLayer({
  url,
  dataset,
  label,
  bearerToken,
  timeoutMs,
  fetchFn,
  cached
}) {
  let response
  try {
    response = await requestLayer({
      url,
      bearerToken,
      timeoutMs,
      fetchFn,
      cached
    })
  } catch {
    if (cached) {
      return cached
    }
    throw new MapReferenceDataError(
      `${label} reference data is temporarily unavailable`
    )
  }

  if (response.status === NOT_MODIFIED_STATUS) {
    if (!cached) {
      throw new MapReferenceDataError(
        `${label} reference data returned an unexpected cache response`
      )
    }
    return cached
  }
  if (!response.ok) {
    if (cached && response.status >= SERVER_ERROR_STATUS) {
      return cached
    }
    throw new MapReferenceDataError(
      `${label} reference data could not be retrieved`,
      response.status
    )
  }

  return {
    body: await readLayer(response, dataset, label),
    etag: response.headers?.get('etag') || undefined
  }
}

// Shared ETag-cached client for the Reference Data Service GeoJSON map layers.
export function createMapGeoJsonReferenceDataClient({
  endpoint,
  dataset,
  label,
  serviceUrl,
  token,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchFn = (...args) => globalThis.fetch(...args)
}) {
  let cached
  let inFlight = null

  async function getLayer() {
    const bearerToken = typeof token === 'function' ? token() : token
    if (!serviceUrl || !bearerToken) {
      throw new MapReferenceDataError(
        `${label} reference data is not configured`
      )
    }
    if (inFlight) {
      return inFlight
    }

    inFlight = fetchLayer({
      url: `${serviceUrl.replace(/\/$/, '')}${endpoint}`,
      dataset,
      label,
      bearerToken,
      timeoutMs,
      fetchFn,
      cached
    }).then((result) => {
      cached = result
      return result
    })
    try {
      return await inFlight
    } finally {
      inFlight = null
    }
  }

  return { getLayer }
}
