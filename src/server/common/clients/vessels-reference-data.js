const VESSELS_PATH = '/api/v1/reference-data/vessels'
const DEFAULT_TIMEOUT_MS = 3000
const INVALID_RESPONSE_MESSAGE =
  'Vessels reference data returned an invalid response'
const NOT_MODIFIED_STATUS = 304
const SERVER_ERROR_STATUS = 500
const SERVICE_UNAVAILABLE_STATUS = 503

export class VesselsReferenceDataError extends Error {
  constructor(message, statusCode = SERVICE_UNAVAILABLE_STATUS) {
    super(message)
    this.name = 'VesselsReferenceDataError'
    this.statusCode = statusCode
  }
}

function mapVessel(item) {
  if (
    typeof item?.id !== 'string' ||
    typeof item.name !== 'string' ||
    (item.pln !== null && typeof item.pln !== 'string') ||
    (item.cfr !== null && typeof item.cfr !== 'string')
  ) {
    throw new VesselsReferenceDataError(INVALID_RESPONSE_MESSAGE)
  }
  return {
    id: item.id,
    name: item.name,
    pln: item.pln,
    cfr: item.cfr,
    displayName: item.displayName,
    lengthOverallMetres: item.lengthOverallMetres
  }
}

function mapItem(item, view) {
  if (view === 'canonical') {
    if (typeof item?.id !== 'string' || typeof item.name !== 'string') {
      throw new VesselsReferenceDataError(INVALID_RESPONSE_MESSAGE)
    }
    return item
  }
  return mapVessel(item)
}

function assertPage(page, offset, total, version) {
  if (
    (total !== undefined && page.total !== total) ||
    (version !== undefined && page.version !== version) ||
    (page.items.length === 0 && offset < page.total)
  ) {
    throw new VesselsReferenceDataError(INVALID_RESPONSE_MESSAGE)
  }
}

async function requestVesselData(
  { serviceUrl, token, timeoutMs, fetchFn },
  path,
  etag
) {
  const bearerToken = typeof token === 'function' ? token() : token
  if (!serviceUrl || !bearerToken) {
    throw new VesselsReferenceDataError(
      'Vessels reference data is not configured'
    )
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetchFn(`${serviceUrl.replace(/\/$/, '')}${path}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${bearerToken}`,
        ...(etag ? { 'If-None-Match': etag } : {})
      },
      signal: controller.signal
    })
  } catch {
    throw new VesselsReferenceDataError(
      'Vessels reference data is temporarily unavailable'
    )
  } finally {
    clearTimeout(timeout)
  }
}

function isValidPageBody(body, offset) {
  return (
    Number.isSafeInteger(body?.total) &&
    body.total >= 0 &&
    body.offset === offset &&
    Number.isSafeInteger(body.limit) &&
    body.limit >= 1 &&
    Array.isArray(body.items)
  )
}

async function readVesselPage(
  configuration,
  request,
  path,
  previous,
  offset,
  view
) {
  const response = await request(path, previous?.etag)
  if (response.status === NOT_MODIFIED_STATUS && previous) {
    return previous
  }
  if (!response.ok) {
    throw new VesselsReferenceDataError(
      'Vessels reference data could not be retrieved',
      response.status
    )
  }
  let body
  try {
    body = await response.json()
  } catch {
    throw new VesselsReferenceDataError(INVALID_RESPONSE_MESSAGE)
  }
  if (!isValidPageBody(body, offset)) {
    throw new VesselsReferenceDataError(INVALID_RESPONSE_MESSAGE)
  }
  return {
    items: body.items.map((item) => mapItem(item, view)),
    total: body.total,
    version: body.version,
    etag: response.headers?.get('etag') || undefined
  }
}

function readVesselCollection(
  configuration,
  request,
  key,
  query,
  cached,
  view
) {
  const pages = new Map()
  const items = []

  function readNextPage(offset, total, version) {
    const path = `${VESSELS_PATH}?${query}&offset=${offset}`
    return readVesselPage(
      configuration,
      request,
      path,
      cached?.pages.get(offset),
      offset,
      view
    ).then((page) => {
      assertPage(page, offset, total, version)
      pages.set(offset, page)
      items.push(...page.items)
      const nextOffset = offset + page.items.length
      if (nextOffset < page.total) {
        return readNextPage(nextOffset, page.total, page.version)
      }
      return { items, pages }
    })
  }

  return readNextPage(0).then((catalogue) => {
    configuration.cache.set(key, catalogue)
    return catalogue.items
  })
}

export function createVesselsReferenceDataClient({
  serviceUrl,
  token,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchFn = (...args) => globalThis.fetch(...args)
} = {}) {
  const cache = new Map()
  const inFlight = new Map()
  const configuration = { serviceUrl, token, timeoutMs, fetchFn, cache }
  const request = (path, etag) => requestVesselData(configuration, path, etag)

  async function getVessels(filters = {}) {
    if (!serviceUrl || !(typeof token === 'function' ? token() : token)) {
      throw new VesselsReferenceDataError(
        'Vessels reference data is not configured'
      )
    }
    const query = new URLSearchParams({ view: 'mobile' })
    for (const [name, value] of Object.entries(filters)) {
      query.set(name, String(value))
    }
    const key = query.toString()
    if (inFlight.has(key)) {
      return inFlight.get(key)
    }
    const cached = cache.get(key)
    const pending = readVesselCollection(
      configuration,
      request,
      key,
      key,
      cached,
      query.get('view')
    ).catch((error) => {
      if (cached && error.statusCode >= SERVER_ERROR_STATUS) {
        return cached.items
      }
      throw error
    })
    inFlight.set(key, pending)
    try {
      return await pending
    } finally {
      inFlight.delete(key)
    }
  }

  async function getVessel(id, { view = 'mobile' } = {}) {
    const response = await request(
      `${VESSELS_PATH}/${encodeURIComponent(id)}?view=${encodeURIComponent(view)}`
    )
    if (!response.ok) {
      throw new VesselsReferenceDataError(
        'Vessel reference data could not be retrieved',
        response.status
      )
    }
    try {
      return mapItem(await response.json(), view)
    } catch {
      throw new VesselsReferenceDataError(
        'Vessels reference data returned an invalid response'
      )
    }
  }

  return { getVessels, getVessel }
}
