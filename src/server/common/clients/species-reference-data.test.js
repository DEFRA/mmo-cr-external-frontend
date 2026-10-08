import { createSpeciesReferenceDataClient } from './species-reference-data.js'

const speciesItem = {
  id: '00000000-0000-4000-8000-000000000041',
  faoCode: 'COD',
  scientificName: 'Gadus morhua',
  displayName: 'Cod'
}

function response({
  items = [speciesItem],
  etag = '"species-v1"',
  total = items.length,
  offset = 0,
  limit = 50,
  version = 'v1'
} = {}) {
  return {
    ok: true,
    status: 200,
    headers: { get: (name) => (name === 'etag' ? etag : null) },
    json: async () => ({ items, total, offset, limit, version })
  }
}

describe('#createSpeciesReferenceDataClient', () => {
  test('Should fetch and map mobile species with auth and locale headers', async () => {
    const fetchFn = vi.fn().mockResolvedValue(response())
    const client = createSpeciesReferenceDataClient({
      serviceUrl: 'http://localhost:3002/',
      token: 'test-token',
      fetchFn
    })

    const species = await client.getSpeciesCatalogue('cy')

    expect(fetchFn).toHaveBeenCalledWith(
      'http://localhost:3002/api/v1/reference-data/species?view=mobile&offset=0',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          'Accept-Language': 'cy'
        })
      })
    )
    expect(species).toEqual([
      {
        id: speciesItem.id,
        code: 'COD',
        faoCode: 'COD',
        displayName: 'Cod',
        scientificName: 'Gadus morhua',
        text: 'Cod (COD)'
      }
    ])
  })

  test('Should send the default English tag when no language is supplied', async () => {
    const fetchFn = vi.fn().mockResolvedValue(response())
    const client = createSpeciesReferenceDataClient({
      serviceUrl: 'http://localhost:3002',
      token: 'test-token',
      fetchFn
    })

    await client.getSpeciesCatalogue()

    expect(fetchFn.mock.calls[0][1].headers['Accept-Language']).toBe('en')
  })

  test('Should send If-None-Match and reuse cached items on 304', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(response())
      .mockResolvedValueOnce({ ok: false, status: 304 })
    const client = createSpeciesReferenceDataClient({
      serviceUrl: 'http://localhost:3002',
      token: 'test-token',
      fetchFn
    })

    const first = await client.getSpeciesCatalogue('en-GB')
    const second = await client.getSpeciesCatalogue('en-GB')

    expect(fetchFn.mock.calls[1][1].headers['If-None-Match']).toBe(
      '"species-v1"'
    )
    expect(second).toBe(first)
  })

  test('Should collect all pages and revalidate each page independently', async () => {
    const secondSpecies = {
      ...speciesItem,
      id: '00000000-0000-4000-8000-000000000042',
      faoCode: 'HAD',
      displayName: 'Haddock'
    }
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        response({ items: [speciesItem], total: 2, limit: 1, etag: '"first"' })
      )
      .mockResolvedValueOnce(
        response({
          items: [secondSpecies],
          total: 2,
          offset: 1,
          limit: 1,
          etag: '"second"'
        })
      )
      .mockResolvedValueOnce({ ok: false, status: 304 })
      .mockResolvedValueOnce({ ok: false, status: 304 })
    const client = createSpeciesReferenceDataClient({
      serviceUrl: 'http://localhost:3002',
      token: 'test-token',
      fetchFn
    })

    const first = await client.getSpeciesCatalogue()
    const second = await client.getSpeciesCatalogue()

    expect(first.map((species) => species.code)).toEqual(['COD', 'HAD'])
    expect(fetchFn.mock.calls[1][0]).toContain('&offset=1')
    expect(fetchFn.mock.calls[2][1].headers['If-None-Match']).toBe('"first"')
    expect(fetchFn.mock.calls[3][1].headers['If-None-Match']).toBe('"second"')
    expect(second).toBe(first)
  })

  test('Should keep the complete cached catalogue when a later page fails', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(response())
      .mockResolvedValueOnce(response({ total: 2, limit: 1 }))
      .mockRejectedValueOnce(new Error('network failure'))
    const client = createSpeciesReferenceDataClient({
      serviceUrl: 'http://localhost:3002',
      token: 'test-token',
      fetchFn
    })

    const first = await client.getSpeciesCatalogue()
    const second = await client.getSpeciesCatalogue()

    expect(second).toBe(first)
  })

  test('Should serve the last successful catalogue after a transient network error', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(response())
      .mockRejectedValueOnce(new Error('network failure'))
    const client = createSpeciesReferenceDataClient({
      serviceUrl: 'http://localhost:3002',
      token: 'test-token',
      fetchFn
    })

    const first = await client.getSpeciesCatalogue()
    const second = await client.getSpeciesCatalogue()

    expect(second).toBe(first)
  })

  test('Should not make a request when no token is configured', async () => {
    const fetchFn = vi.fn()
    const client = createSpeciesReferenceDataClient({
      serviceUrl: 'http://localhost:3002',
      fetchFn
    })

    await expect(client.getSpeciesCatalogue()).rejects.toThrow(
      'Species reference data authentication is not configured'
    )
    expect(fetchFn).not.toHaveBeenCalled()
  })

  test('Should reject an invalid mobile species response', async () => {
    const client = createSpeciesReferenceDataClient({
      serviceUrl: 'http://localhost:3002',
      token: 'test-token',
      fetchFn: vi
        .fn()
        .mockResolvedValue(response({ items: [{ id: 'missing' }] }))
    })

    await expect(client.getSpeciesCatalogue()).rejects.toThrow(
      'Species reference data returned an invalid response'
    )
  })

  test('Should reject when no service URL is configured', async () => {
    const fetchFn = vi.fn()
    const client = createSpeciesReferenceDataClient({
      token: 'test-token',
      fetchFn
    })

    await expect(client.getSpeciesCatalogue()).rejects.toThrow(
      'Species reference data is not configured'
    )
    expect(fetchFn).not.toHaveBeenCalled()
  })

  test('Should reject an invalid not-modified response without a cached page', async () => {
    const client = createSpeciesReferenceDataClient({
      serviceUrl: 'http://localhost:3002',
      token: 'test-token',
      fetchFn: vi.fn().mockResolvedValue({ ok: false, status: 304 })
    })

    await expect(client.getSpeciesCatalogue()).rejects.toMatchObject({
      message: 'Species reference data returned an unexpected cache response'
    })
  })

  test('Should preserve the cached species after an upstream server error', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(response())
      .mockResolvedValueOnce({ ok: false, status: 503 })
    const client = createSpeciesReferenceDataClient({
      serviceUrl: 'http://localhost:3002',
      token: 'test-token',
      fetchFn
    })

    const cached = await client.getSpeciesCatalogue()
    await expect(client.getSpeciesCatalogue()).resolves.toBe(cached)
  })
})
