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

    const languageKey = acceptLanguage || ''
    const cached = cacheByLanguage.get(languageKey)
    const inFlight = inFlightByLanguage.get(languageKey)
    if (inFlight) {
      return inFlight
    }

    const request = fetchCatalogue({
      acceptLanguage,
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

  async function fetchCatalogue({ acceptLanguage, cached, bearerToken }) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    const headers = {
      Accept: 'application/json',
      Authorization: `Bearer ${bearerToken}`,
      ...(acceptLanguage ? { 'Accept-Language': acceptLanguage } : {}),
      ...(cached?.etag ? { 'If-None-Match': cached.etag } : {})
    }

    try {
      let response
      try {
        response = await fetchFn(
          `${serviceUrl.replace(/\/$/, '')}${SPECIES_ENDPOINT}`,
          {
            method: 'GET',
            headers,
            signal: controller.signal
          }
        )
      } catch {
        return getStaleOrThrow(
          cached,
          new SpeciesReferenceDataError(
            'Species reference data is temporarily unavailable'
          )
        )
      }

      if (response.status === 304) {
        if (!cached) {
          throw new SpeciesReferenceDataError(
            'Species reference data returned an unexpected cache response'
          )
        }
        return cached.items
      }

      if (!response.ok) {
        const error = new SpeciesReferenceDataError(
          response.status >= 500
            ? 'Species reference data is temporarily unavailable'
            : 'Species reference data could not be retrieved',
          response.status
        )
        return getStaleOrThrow(cached, error)
      }

      let body
      try {
        body = await response.json()
      } catch {
        throw new SpeciesReferenceDataError(
          'Species reference data returned an invalid response'
        )
      }

      const items = mapSpecies(body?.items)
      cacheByLanguage.set(acceptLanguage || '', {
        etag: response.headers?.get('etag') || undefined,
        items
      })
      return items
    } finally {
      clearTimeout(timeout)
    }
  }

  return { getSpeciesCatalogue }
}
