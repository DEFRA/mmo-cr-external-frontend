const PORTS_ENDPOINT = '/api/v1/reference-data/ports?view=mobile'
const DEFAULT_TIMEOUT_MS = 3000
const INVALID_RESPONSE_MESSAGE =
  'Ports reference data returned an invalid response'
const NOT_MODIFIED_STATUS = 304
const SERVER_ERROR_STATUS = 500
const SERVICE_UNAVAILABLE_STATUS = 503

export class PortsReferenceDataError extends Error {
  constructor(message, statusCode = SERVICE_UNAVAILABLE_STATUS) {
    super(message)
    this.name = 'PortsReferenceDataError'
    this.statusCode = statusCode
  }
}

function mapPort(port) {
  if (
    typeof port?.id !== 'string' ||
    typeof port.code !== 'string' ||
    typeof port.name !== 'string'
  ) {
    throw new PortsReferenceDataError(INVALID_RESPONSE_MESSAGE)
  }
  return {
    id: port.id,
    code: port.code,
    name: port.name,
    coordinate: port.coordinate
  }
}

function validatePage(page, offset, total, version) {
  if (
    (total !== undefined && page.total !== total) ||
    (version !== undefined && page.version !== version) ||
    (page.items.length === 0 && offset < page.total)
  ) {
    throw new PortsReferenceDataError(INVALID_RESPONSE_MESSAGE)
  }
}

async function requestReferenceData(
  { serviceUrl, token, timeoutMs, fetchFn },
  path,
  etag
) {
  const bearerToken = typeof token === 'function' ? token() : token
  if (!serviceUrl || !bearerToken) {
    throw new PortsReferenceDataError('Ports reference data is not configured')
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
    throw new PortsReferenceDataError(
      'Ports reference data is temporarily unavailable'
    )
  } finally {
    clearTimeout(timeout)
  }
}

function parsePageBody(body, offset) {
  if (
    !Number.isSafeInteger(body?.total) ||
    body.total < 0 ||
    body.offset !== offset ||
    !Number.isSafeInteger(body.limit) ||
    body.limit < 1 ||
    !Array.isArray(body.items)
  ) {
    throw new PortsReferenceDataError(INVALID_RESPONSE_MESSAGE)
  }
  return body
}

async function readPortPage(request, offset, previous) {
  const response = await request(
    `${PORTS_ENDPOINT}&offset=${offset}`,
    previous?.etag
  )
  if (response.status === NOT_MODIFIED_STATUS && previous) {
    return previous
  }
  if (!response.ok) {
    throw new PortsReferenceDataError(
      'Ports reference data could not be retrieved',
      response.status
    )
  }
  let body
  try {
    body = await response.json()
  } catch {
    throw new PortsReferenceDataError(INVALID_RESPONSE_MESSAGE)
  }
  body = parsePageBody(body, offset)
  return {
    items: body.items.map(mapPort),
    total: body.total,
    version: body.version,
    etag: response.headers?.get('etag') || undefined
  }
}

function readPortsCatalogue(request, cached) {
  const pages = new Map()
  const items = []

  function readNextPage(offset, total, version) {
    return readPortPage(request, offset, cached?.pages.get(offset)).then(
      (page) => {
        validatePage(page, offset, total, version)
        pages.set(offset, page)
        items.push(...page.items)
        const nextOffset = offset + page.items.length
        if (nextOffset < page.total) {
          return readNextPage(nextOffset, page.total, page.version)
        }
        return { items, pages }
      }
    )
  }

  return readNextPage(0)
}

export function createPortsReferenceDataClient({
  serviceUrl,
  token,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchFn = (...args) => globalThis.fetch(...args)
} = {}) {
  let cached
  let inFlight = null
  const request = (path, etag) =>
    requestReferenceData({ serviceUrl, token, timeoutMs, fetchFn }, path, etag)

  async function getPorts() {
    if (!serviceUrl || !(typeof token === 'function' ? token() : token)) {
      throw new PortsReferenceDataError(
        'Ports reference data is not configured'
      )
    }
    if (inFlight) {
      return inFlight
    }
    inFlight = readPortsCatalogue(request, cached)
      .then((catalogue) => {
        cached = catalogue
        return catalogue.items
      })
      .catch((error) => {
        if (cached && error.statusCode >= SERVER_ERROR_STATUS) {
          return cached.items
        }
        throw error
      })
    try {
      return await inFlight
    } finally {
      inFlight = null
    }
  }

  async function getPort(id) {
    const response = await request(
      `/api/v1/reference-data/ports/${encodeURIComponent(id)}?view=mobile`
    )
    if (!response.ok) {
      throw new PortsReferenceDataError(
        'Port reference data could not be retrieved',
        response.status
      )
    }
    try {
      return mapPort(await response.json())
    } catch {
      throw new PortsReferenceDataError(INVALID_RESPONSE_MESSAGE)
    }
  }

  return { getPorts, getPort }
}
