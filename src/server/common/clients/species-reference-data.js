const SPECIES_ENDPOINT = '/api/v1/reference-data/species?view=mobile'
const DEFAULT_TIMEOUT_MS = 3000

export class SpeciesReferenceDataError extends Error {
  constructor(message, statusCode = 503) {
    super(message)
    this.name = 'SpeciesReferenceDataError'
    this.statusCode = statusCode
  }
}

function mapSpecies(items) {
  if (!Array.isArray(items)) {
    throw new SpeciesReferenceDataError(
      'Species reference data returned an invalid response'
    )
  }

  return items.map((item) => {
    if (
      typeof item?.id !== 'string' ||
      typeof item.faoCode !== 'string' ||
      typeof item.displayName !== 'string'
    ) {
      throw new SpeciesReferenceDataError(
        'Species reference data returned an invalid response'
      )
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
  if (cached && (error instanceof TypeError || error.statusCode >= 500)) {
    return cached.items
  }
  throw error
}

export function createSpeciesReferenceDataClient({
  serviceUrl,
  token,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchFn = (...args) => globalThis.fetch(...args)
} = {}) {
  const cacheByLanguage = new Map()
  const inFlightByLanguage = new Map()

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
        503
      )
    }

    const languageKey = acceptLanguage || 'en'
    const cached = cacheByLanguage.get(languageKey)
    const inFlight = inFlightByLanguage.get(languageKey)
    if (inFlight) {
      return inFlight
    }

    const request = fetchCatalogue({
      acceptLanguage: languageKey,
      cached,
      bearerToken
    })
    inFlightByLanguage.set(languageKey, request)

    try {
      return await request
    } finally {
      inFlightByLanguage.delete(languageKey)
    }
  }

  async function fetchPage({
    offset,
    previousPage,
    acceptLanguage,
    bearerToken
  }) {
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
            ...(previousPage?.etag
              ? { 'If-None-Match': previousPage.etag }
              : {})
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

    if (response.status === 304) {
      if (!previousPage) {
        throw new SpeciesReferenceDataError(
          'Species reference data returned an unexpected cache response'
        )
      }
      return previousPage
    }
    if (!response.ok) {
      throw new SpeciesReferenceDataError(
        response.status >= 500
          ? 'Species reference data is temporarily unavailable'
          : 'Species reference data could not be retrieved',
        response.status
      )
    }

    let body
    try {
      body = await response.json()
    } catch {
      throw new SpeciesReferenceDataError(
        'Species reference data returned an invalid response'
      )
    }

    if (
      !Number.isSafeInteger(body?.total) ||
      body.total < 0 ||
      body.offset !== offset ||
      !Number.isSafeInteger(body.limit) ||
      body.limit <= 0
    ) {
      throw new SpeciesReferenceDataError(
        'Species reference data returned an invalid response'
      )
    }
    return {
      etag: response.headers?.get('etag') || undefined,
      items: mapSpecies(body.items),
      total: body.total,
      version: body.version
    }
  }

  async function fetchCatalogue({ acceptLanguage, cached, bearerToken }) {
    try {
      const pages = new Map()
      const items = []
      let offset = 0
      let total
      let version

      do {
        const page = await fetchPage({
          offset,
          previousPage: cached?.pages.get(offset),
          acceptLanguage,
          bearerToken
        })
        if (
          (total !== undefined && page.total !== total) ||
          (version !== undefined && page.version !== version) ||
          (page.items.length === 0 && offset < page.total)
        ) {
          throw new SpeciesReferenceDataError(
            'Species reference data returned an invalid response'
          )
        }
        total = page.total
        version = page.version
        pages.set(offset, page)
        items.push(...page.items)
        offset += page.items.length
      } while (offset < total)

      const catalogue = { items, pages }
      cacheByLanguage.set(acceptLanguage, catalogue)
      return cached?.pages.size === pages.size &&
        [...pages].every(
          ([pageOffset, page]) => page === cached.pages.get(pageOffset)
        )
        ? cached.items
        : items
    } catch (error) {
      return getStaleOrThrow(cached, error)
    }
  }

  return { getSpeciesCatalogue }
}
