import { createSpeciesReferenceDataClient } from './species-reference-data.js'

const speciesItem = {
  id: '00000000-0000-4000-8000-000000000041',
  faoCode: 'COD',
  scientificName: 'Gadus morhua',
  displayName: 'Cod'
}

function response({ items = [speciesItem], etag = '"species-v1"' } = {}) {
  return {
    ok: true,
    status: 200,
    headers: { get: (name) => (name === 'etag' ? etag : null) },
    json: async () => ({ items })
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
      'http://localhost:3002/api/v1/reference-data/species?view=mobile',
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
})
