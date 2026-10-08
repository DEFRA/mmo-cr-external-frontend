import { createMapLandReferenceDataClient } from './map-land-reference-data.js'

const featureCollection = {
  type: 'FeatureCollection',
  metadata: { dataset: 'map-land', crs: 'EPSG:4326', featureCount: 1 },
  features: [
    {
      type: 'Feature',
      id: 'land-1',
      properties: { name: 'Land' },
      geometry: { type: 'Polygon', coordinates: [] }
    }
  ]
}

function response({
  body = featureCollection,
  status = 200,
  etag = '"land-v1"'
} = {}) {
  return {
    ok: status === 200,
    status,
    headers: { get: (name) => (name.toLowerCase() === 'etag' ? etag : null) },
    json: async () => body
  }
}

describe('#createMapLandReferenceDataClient', () => {
  test('Should fetch GeoJSON with bearer auth and cache using ETag', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(response())
      .mockResolvedValueOnce(response({ status: 304 }))
    const client = createMapLandReferenceDataClient({
      serviceUrl: 'http://localhost:3002/',
      token: 'test-token',
      fetchFn
    })

    const first = await client.getLand()
    const second = await client.getLand()

    expect(first.body).toEqual(featureCollection)
    expect(second).toBe(first)
    expect(fetchFn.mock.calls[0][0]).toBe(
      'http://localhost:3002/api/v1/reference-data/map/land'
    )
    expect(fetchFn.mock.calls[0][1].headers.Authorization).toBe(
      'Bearer test-token'
    )
    expect(fetchFn.mock.calls[0][1].headers.Accept).toContain(
      'application/geo+json'
    )
    expect(fetchFn.mock.calls[1][1].headers['If-None-Match']).toBe('"land-v1"')
  })

  test('Should serve the last successful layer after a transient failure', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(response())
      .mockRejectedValueOnce(new Error('offline'))
    const client = createMapLandReferenceDataClient({
      serviceUrl: 'http://localhost:3002',
      token: 'test-token',
      fetchFn
    })

    const first = await client.getLand()
    expect(await client.getLand()).toBe(first)
  })

  test('Should fail closed when token is missing', async () => {
    const fetchFn = vi.fn()
    const client = createMapLandReferenceDataClient({
      serviceUrl: 'http://localhost:3002',
      fetchFn
    })

    await expect(client.getLand()).rejects.toThrow('not configured')
    expect(fetchFn).not.toHaveBeenCalled()
  })

  test('Should reject an unexpected 304 response without a cached layer', async () => {
    const client = createMapLandReferenceDataClient({
      serviceUrl: 'http://localhost:3002',
      token: 'test-token',
      fetchFn: vi.fn().mockResolvedValue(response({ status: 304 }))
    })

    await expect(client.getLand()).rejects.toMatchObject({
      statusCode: 503,
      message: 'Map land reference data returned an unexpected cache response'
    })
  })

  test.each([
    [null, 'Map land reference data returned an invalid response'],
    [
      { type: 'FeatureCollection', features: [] },
      'Map land reference data returned an invalid response'
    ],
    [
      { ...featureCollection, metadata: { dataset: 'other' } },
      'Map land reference data returned an invalid response'
    ]
  ])('Should reject an invalid GeoJSON response', async (body, message) => {
    const client = createMapLandReferenceDataClient({
      serviceUrl: 'http://localhost:3002',
      token: 'test-token',
      fetchFn: vi.fn().mockResolvedValue(response({ body }))
    })

    await expect(client.getLand()).rejects.toMatchObject({ message })
  })

  test('Should preserve the cached layer after a server error', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(response())
      .mockResolvedValueOnce(response({ status: 503 }))
    const client = createMapLandReferenceDataClient({
      serviceUrl: 'http://localhost:3002',
      token: 'test-token',
      fetchFn
    })

    const cached = await client.getLand()
    await expect(client.getLand()).resolves.toBe(cached)
  })

  test('Should surface a client error response when no cache is available', async () => {
    const client = createMapLandReferenceDataClient({
      serviceUrl: 'http://localhost:3002',
      token: 'test-token',
      fetchFn: vi.fn().mockResolvedValue(response({ status: 404 }))
    })

    await expect(client.getLand()).rejects.toMatchObject({ statusCode: 404 })
  })
})
