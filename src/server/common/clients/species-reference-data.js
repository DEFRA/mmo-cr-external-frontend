const SPECIES_ENDPOINT = '/api/v1/reference-data/species?view=mobile'
const DEFAULT_TIMEOUT_MS = 3000
const INVALID_RESPONSE_MESSAGE =
  'Species reference data returned an invalid response'
const SERVER_ERROR_STATUS = 500
const SERVICE_UNAVAILABLE_STATUS = 503
const NOT_MODIFIED_STATUS = 304

export class SpeciesReferenceDataError extends Error {
  constructor(message, statusCode = 503) {
    super(message)
    this.name = 'SpeciesReferenceDataError'
    this.statusCode = statusCode
  }
}

function mapSpecies(items) {
  if (!Array.isArray(items)) {
    throw new SpeciesReferenceDataError(INVALID_RESPONSE_MESSAGE)
  }

  return items.map((item) => {
    if (
      typeof item?.id !== 'string' ||
      typeof item.faoCode !== 'string' ||
      typeof item.displayName !== 'string'
    ) {
      throw new SpeciesReferenceDataError(INVALID_RESPONSE_MESSAGE)
    }

    return {
      id: item.id,
      code: item.faoCode,
      faoCode: item.faoCode,
      displayName: item.displayName,
      scientificName: item.scientificName,
      text: `${item.displayName} (${item.faoCode})`
    }
  })
}

function getStaleOrThrow(cached, error) {
  if (
    cached &&
    (error instanceof TypeError || error.statusCode >= SERVER_ERROR_STATUS)
  ) {
    return cached.items
  }
  throw error
}

async function fetchSpeciesPage(
  { serviceUrl, timeoutMs, fetchFn },
  { offset, previousPage, acceptLanguage, bearerToken }
) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  let response
  try {
    response = await fetchFn(
      `${serviceUrl.replace(/\/$/, '')}${SPECIES_ENDPOINT}&offset=${offset}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${bearerToken}`,
          'Accept-Language': acceptLanguage,
          ...(previousPage?.etag ? { 'If-None-Match': previousPage.etag } : {})
        },
        signal: controller.signal
      }
    )
  } catch {
    throw new SpeciesReferenceDataError(
      'Species reference data is temporarily unavailable'
    )
  } finally {
    clearTimeout(timeout)
  }

  if (response.status === NOT_MODIFIED_STATUS) {
    if (!previousPage) {
      throw new SpeciesReferenceDataError(
        'Species reference data returned an unexpected cache response'
      )
    }
    return previousPage
  }
  if (!response.ok) {
    throw new SpeciesReferenceDataError(
      response.status >= SERVER_ERROR_STATUS
        ? 'Species reference data is temporarily unavailable'
        : 'Species reference data could not be retrieved',
      response.status
    )
  }

  let body
  try {
    body = await response.json()
  } catch {
    throw new SpeciesReferenceDataError(INVALID_RESPONSE_MESSAGE)
  }

  if (
    !Number.isSafeInteger(body?.total) ||
    body.total < 0 ||
    body.offset !== offset ||
    !Number.isSafeInteger(body.limit) ||
    body.limit <= 0
  ) {
    throw new SpeciesReferenceDataError(INVALID_RESPONSE_MESSAGE)
  }
  return {
    etag: response.headers?.get('etag') || undefined,
    items: mapSpecies(body.items),
    total: body.total,
    version: body.version
  }
}

function pageMetadataIsConsistent(page, offset, total, version) {
  return !(
    (total !== undefined && page.total !== total) ||
    (version !== undefined && page.version !== version) ||
    (page.items.length === 0 && offset < page.total)
  )
}

function fetchSpeciesCatalogue(
  configuration,
  { acceptLanguage, cached, bearerToken }
) {
  const pages = new Map()
  const items = []

  function fetchNextPage(offset, total, version) {
    return fetchSpeciesPage(configuration, {
      offset,
      previousPage: cached?.pages.get(offset),
      acceptLanguage,
      bearerToken
    }).then((page) => {
      if (!pageMetadataIsConsistent(page, offset, total, version)) {
        throw new SpeciesReferenceDataError(INVALID_RESPONSE_MESSAGE)
      }
      pages.set(offset, page)
      items.push(...page.items)
      const nextOffset = offset + page.items.length
      if (nextOffset < page.total) {
        return fetchNextPage(nextOffset, page.total, page.version)
      }

      const catalogue = { items, pages }
      configuration.cacheByLanguage.set(acceptLanguage, catalogue)
      return cached?.pages.size === pages.size &&
        [...pages].every(
          ([pageOffset, fetchedPage]) =>
            fetchedPage === cached.pages.get(pageOffset)
        )
        ? cached.items
        : items
    })
  }

  return fetchNextPage(0).catch((error) => getStaleOrThrow(cached, error))
}

export function createSpeciesReferenceDataClient({
  serviceUrl,
  token,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchFn = (...args) => globalThis.fetch(...args)
} = {}) {
  const cacheByLanguage = new Map()
  const inFlightByLanguage = new Map()
  const configuration = { serviceUrl, timeoutMs, fetchFn }

  async function getSpeciesCatalogue(acceptLanguage) {
    if (!serviceUrl) {
      throw new SpeciesReferenceDataError(
        'Species reference data is not configured'
      )
    }
    const bearerToken = typeof token === 'function' ? token() : token
    if (!bearerToken) {
      throw new SpeciesReferenceDataError(
        'Species reference data authentication is not configured',
        SERVICE_UNAVAILABLE_STATUS
      )
    }

    const languageKey = acceptLanguage || 'en'
    const cached = cacheByLanguage.get(languageKey)
    const inFlight = inFlightByLanguage.get(languageKey)
    if (inFlight) {
      return inFlight
    }

    const request = fetchSpeciesCatalogue(
      { ...configuration, cacheByLanguage },
      { acceptLanguage: languageKey, cached, bearerToken }
    )
    inFlightByLanguage.set(languageKey, request)

    try {
      return await request
    } finally {
      inFlightByLanguage.delete(languageKey)
    }
  }

  return { getSpeciesCatalogue }
}
