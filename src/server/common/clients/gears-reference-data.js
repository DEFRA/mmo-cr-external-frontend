const GEARS_PATH = '/api/v1/reference-data/gears'
const DEFAULT_TIMEOUT_MS = 3000
const DEFAULT_PAGE_LIMIT = 500
const NOT_MODIFIED_STATUS = 304
const SERVER_ERROR_STATUS = 500
const THROWDATAERROR = 'Gears reference data returned an invalid response'

export class GearsReferenceDataError extends Error {
  constructor(message, statusCode = 503) {
    super(message)
    this.name = 'GearsReferenceDataError'
    this.statusCode = statusCode
  }
}

function mapMeasurements(gear, measurements = []) {
  const byId = new Map(
    measurements.map((measurement) => [measurement.id, measurement])
  )
  const required = new Set(gear.requiredMeasurementIds || [])
  const ids = [...required, ...(gear.variableMeasurementIds || [])]
  return [...new Set(ids)]
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((measurement) => ({
      id: measurement.id,
      code: measurement.code,
      label: measurement.label,
      kind: measurement.kind,
      unit: measurement.unit,
      minimumValue: measurement.minimumValue,
      maximumValue: measurement.maximumValue,
      required: required.has(measurement.id)
    }))
}

function mapGear(item, measurements = []) {
  if (
    typeof item?.id !== 'string' ||
    typeof item.code !== 'string' ||
    typeof item.name !== 'string'
  ) {
    throw new GearsReferenceDataError(THROWDATAERROR)
  }
  return {
    ...item,
    label: item.name,
    hint: item.category?.name || null,
    measurements: mapMeasurements(item, measurements)
  }
}

function validatePage(page, offset, total, version) {
  if (
    (total !== undefined && page.total !== total) ||
    (version !== undefined && page.version !== version) ||
    (page.items.length === 0 && offset < page.total)
  ) {
    throw new GearsReferenceDataError(THROWDATAERROR)
  }
}

async function requestReferenceData(config, path, etag) {
  const { serviceUrl, token, timeoutMs, fetchFn } = config
  const bearerToken = typeof token === 'function' ? token() : token
  if (!serviceUrl || !bearerToken) {
    throw new GearsReferenceDataError('Gears reference data is not configured')
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
    throw new GearsReferenceDataError(
      'Gears reference data is temporarily unavailable'
    )
  } finally {
    clearTimeout(timeout)
  }
}

function hasValidPageBody(body, offset, view) {
  if (!Number.isSafeInteger(body?.total)) {
    return false
  }
  if (body.total < 0) {
    return false
  }
  if (body.offset !== offset) {
    return false
  }
  if (!Number.isSafeInteger(body.limit)) {
    return false
  }
  if (body.limit < 1) {
    return false
  }
  if (!Array.isArray(body.items)) {
    return false
  }
  return view !== 'mobile' || Array.isArray(body.measurements)
}

async function readPage(query, offset, previous, view, request) {
  const params = new URLSearchParams(query)
  params.set('offset', String(offset))
  params.set('limit', String(DEFAULT_PAGE_LIMIT))
  const response = await request(`${GEARS_PATH}?${params}`, previous?.etag)
  if (response.status === NOT_MODIFIED_STATUS && previous) {
    return previous
  }
  if (!response.ok) {
    throw new GearsReferenceDataError(
      'Gears reference data could not be retrieved',
      response.status
    )
  }

  let body
  try {
    body = await response.json()
  } catch {
    throw new GearsReferenceDataError(THROWDATAERROR)
  }
  if (!hasValidPageBody(body, offset, view)) {
    throw new GearsReferenceDataError(THROWDATAERROR)
  }
  return {
    items: body.items,
    measurements: body.measurements || [],
    context: body.context,
    total: body.total,
    limit: body.limit,
    version: body.version,
    etag: response.headers?.get('etag') || undefined
  }
}

async function readCollection(query, cached, { cache, request }) {
  const pages = new Map()
  const records = []
  const measurements = new Map()
  let context
  const view = new URLSearchParams(query).get('view')
  const firstPage = await readPage(
    query,
    0,
    cached?.pages.get(0),
    view,
    request
  )
  validatePage(firstPage, 0)
  const pageOffsets = Array.from(
    { length: Math.ceil(firstPage.total / firstPage.limit) - 1 },
    (_, index) => (index + 1) * firstPage.limit
  )
  const remainingPages = await Promise.all(
    pageOffsets.map((offset) =>
      readPage(query, offset, cached?.pages.get(offset), view, request)
    )
  )
  const pageResults = [firstPage, ...remainingPages]

  for (let index = 0; index < pageResults.length; index += 1) {
    const page = pageResults[index]
    const offset = index === 0 ? 0 : pageOffsets[index - 1]
    validatePage(page, offset, firstPage.total, firstPage.version)
    context = page.context || context
    for (const measurement of page.measurements) {
      measurements.set(measurement.id, measurement)
    }
    records.push(...page.items)
    pages.set(offset, page)
  }

  const measurementList = [...measurements.values()]
  const result = {
    items:
      view === 'canonical'
        ? records
        : records.map((gear) => mapGear(gear, measurementList)),
    measurements: measurementList,
    context,
    total: firstPage.total,
    pages
  }
  cache.set(query, result)
  return result
}

function gearQuery(filters) {
  const params = new URLSearchParams({ view: 'mobile' })
  for (const [name, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(name, String(value))
    }
  }
  return params.toString()
}

function cachedCollectionOrThrow(error, cached) {
  if (
    cached &&
    (error instanceof TypeError || error.statusCode >= SERVER_ERROR_STATUS)
  ) {
    return cached
  }
  throw error
}

async function getGears(
  filters,
  { serviceUrl, token, cache, inFlight, request }
) {
  if (!serviceUrl || !(typeof token === 'function' ? token() : token)) {
    throw new GearsReferenceDataError('Gears reference data is not configured')
  }
  const query = gearQuery(filters)
  if (inFlight.has(query)) {
    return inFlight.get(query)
  }
  const cached = cache.get(query)
  const pending = readCollection(query, cached, { cache, request }).catch(
    (error) => cachedCollectionOrThrow(error, cached)
  )
  inFlight.set(query, pending)
  try {
    return await pending
  } finally {
    inFlight.delete(query)
  }
}

async function getGear(id, { view = 'mobile', itemCache, request }) {
  const key = `${view}:${id}`
  const cached = itemCache.get(key)
  try {
    const response = await request(
      `${GEARS_PATH}/${encodeURIComponent(id)}?view=${encodeURIComponent(view)}`,
      cached?.etag
    )
    if (response.status === NOT_MODIFIED_STATUS && cached) {
      return cached.item
    }
    if (!response.ok) {
      throw new GearsReferenceDataError(
        'Gear reference data could not be retrieved',
        response.status
      )
    }
    const body = await response.json()
    const item = view === 'mobile' ? mapGear(body) : body
    itemCache.set(key, {
      item,
      etag: response.headers?.get('etag') || undefined
    })
    return item
  } catch (error) {
    if (
      cached &&
      (error instanceof TypeError || error.statusCode >= SERVER_ERROR_STATUS)
    ) {
      return cached.item
    }
    if (error instanceof GearsReferenceDataError) {
      throw error
    }
    throw new GearsReferenceDataError(THROWDATAERROR)
  }
}

export function createGearsReferenceDataClient({
  serviceUrl,
  token,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchFn = (...args) => globalThis.fetch(...args)
} = {}) {
  const cache = new Map()
  const inFlight = new Map()
  const itemCache = new Map()
  const request = (path, etag) =>
    requestReferenceData({ serviceUrl, token, timeoutMs, fetchFn }, path, etag)

  return {
    getGears: (filters = {}) =>
      getGears(filters, { serviceUrl, token, cache, inFlight, request }),
    getGear: (id, options = {}) =>
      getGear(id, { ...options, itemCache, request })
  }
}
