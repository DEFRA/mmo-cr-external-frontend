import { createMapPortsReferenceDataClient } from './map-ports-reference-data.js'

const featureCollection = {
  type: 'FeatureCollection',
  metadata: { dataset: 'map-ports', crs: 'EPSG:4326', featureCount: 1 },
  features: [
    {
      type: 'Feature',
      id: '49e319b2-9e65-45aa-a80e-0cf4b20bfe79',
      properties: {
        id: '49e319b2-9e65-45aa-a80e-0cf4b20bfe79',
        code: 'GBAOT',
        name: 'Abbotsbury'
      },
      geometry: { type: 'Point', coordinates: [-2.6, 50.67] }
    }
  ]
}

function response({ body = featureCollection, status = 200 } = {}) {
  return {
    ok: status === 200,
    status,
    headers: {
      get: (name) => (name.toLowerCase() === 'etag' ? '"ports-v1"' : null)
    },
    json: async () => body
  }
}

describe('#createMapPortsReferenceDataClient', () => {
  test('Should fetch the map ports GeoJSON layer with bearer auth', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(response())
      .mockResolvedValueOnce(response({ status: 304 }))
    const client = createMapPortsReferenceDataClient({
      serviceUrl: 'http://localhost:3002/',
      token: () => 'test-token',
      fetchFn
    })

    const first = await client.getPorts()

    expect(first).toEqual({ body: featureCollection, etag: '"ports-v1"' })
    expect(await client.getPorts()).toBe(first)
    expect(fetchFn.mock.calls[0][0]).toBe(
      'http://localhost:3002/api/v1/reference-data/map/ports'
    )
    expect(fetchFn.mock.calls[0][1].headers.Authorization).toBe(
      'Bearer test-token'
    )
    expect(fetchFn.mock.calls[1][1].headers['If-None-Match']).toBe('"ports-v1"')
  })

  test('Should reject a layer that is not the map-ports dataset', async () => {
    const client = createMapPortsReferenceDataClient({
      serviceUrl: 'http://localhost:3002',
      token: 'test-token',
      fetchFn: vi.fn().mockResolvedValue(
        response({
          body: { ...featureCollection, metadata: { dataset: 'map-land' } }
        })
      )
    })

    await expect(client.getPorts()).rejects.toMatchObject({
      statusCode: 503,
      message: 'Map ports reference data returned an invalid response'
    })
  })

  test('Should reject a response body that is not JSON', async () => {
    const client = createMapPortsReferenceDataClient({
      serviceUrl: 'http://localhost:3002',
      token: 'test-token',
      fetchFn: vi.fn().mockResolvedValue({
        ...response(),
        json: async () => {
          throw new SyntaxError('Unexpected token')
        }
      })
    })

    await expect(client.getPorts()).rejects.toMatchObject({
      message: 'Map ports reference data returned an invalid response'
    })
  })

  test('Should report the service as unavailable when the request fails without a cache', async () => {
    const client = createMapPortsReferenceDataClient({
      serviceUrl: 'http://localhost:3002',
      token: 'test-token',
      fetchFn: vi.fn().mockRejectedValue(new Error('offline'))
    })

    await expect(client.getPorts()).rejects.toMatchObject({
      statusCode: 503,
      message: 'Map ports reference data is temporarily unavailable'
    })
  })

  test('Should share one in-flight request between concurrent callers', async () => {
    const fetchFn = vi.fn().mockResolvedValue(response())
    const client = createMapPortsReferenceDataClient({
      serviceUrl: 'http://localhost:3002',
      token: 'test-token',
      fetchFn
    })

    const [first, second] = await Promise.all([
      client.getPorts(),
      client.getPorts()
    ])

    expect(second).toBe(first)
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })
})
