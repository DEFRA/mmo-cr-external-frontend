const PORTS_ENDPOINT = '/api/v1/reference-data/ports?view=mobile'
const DEFAULT_TIMEOUT_MS = 3000

export class PortsReferenceDataError extends Error {
  constructor(message, statusCode = 503) {
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
    throw new PortsReferenceDataError(
      'Ports reference data returned an invalid response'
    )
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
    throw new PortsReferenceDataError(
      'Ports reference data returned an invalid response'
    )
  }
}

export function createPortsReferenceDataClient({
  serviceUrl,
  token,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchFn = (...args) => globalThis.fetch(...args)
} = {}) {
  let cached
  let inFlight

  async function request(path, etag) {
    const bearerToken = typeof token === 'function' ? token() : token
    if (!serviceUrl || !bearerToken) {
      throw new PortsReferenceDataError(
        'Ports reference data is not configured'
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
      throw new PortsReferenceDataError(
        'Ports reference data is temporarily unavailable'
      )
    } finally {
      clearTimeout(timeout)
    }
  }

  async function readCatalogue() {
    const pages = new Map()
    const items = []
    let offset = 0
    let total
    let version

    do {
      const previous = cached?.pages.get(offset)
      const response = await request(
        `${PORTS_ENDPOINT}&offset=${offset}`,
        previous?.etag
      )
      let page
      if (response.status === 304 && previous) {
        page = previous
      } else {
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
          throw new PortsReferenceDataError(
            'Ports reference data returned an invalid response'
          )
        }
        if (
          !Number.isSafeInteger(body?.total) ||
          body.total < 0 ||
          body.offset !== offset ||
          !Number.isSafeInteger(body.limit) ||
          body.limit < 1 ||
          !Array.isArray(body.items)
        ) {
          throw new PortsReferenceDataError(
            'Ports reference data returned an invalid response'
          )
        }
        page = {
          items: body.items.map(mapPort),
          total: body.total,
          version: body.version,
          etag: response.headers?.get('etag') || undefined
        }
      }
      validatePage(page, offset, total, version)
      total = page.total
      version = page.version
      items.push(...page.items)
      pages.set(offset, page)
      offset += page.items.length
    } while (offset < total)

    cached = { items, pages }
    return items
  }

  async function getPorts() {
    if (!serviceUrl || !(typeof token === 'function' ? token() : token)) {
      throw new PortsReferenceDataError(
        'Ports reference data is not configured'
      )
    }
    if (inFlight) {
      return inFlight
    }
    inFlight = readCatalogue().catch((error) => {
      if (cached && error.statusCode >= 500) {
        return cached.items
      }
      throw error
    })
    try {
      return await inFlight
    } finally {
      inFlight = undefined
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
      throw new PortsReferenceDataError(
        'Ports reference data returned an invalid response'
      )
    }
  }

  return { getPorts, getPort }
}
