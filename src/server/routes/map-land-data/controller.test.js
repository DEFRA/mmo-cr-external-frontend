import { createServer } from '#/server/server.js'
import { config } from '#/config/config.js'

const featureCollection = {
  type: 'FeatureCollection',
  metadata: {
    dataset: 'map-land',
    collectionId: 'land-collection',
    schemaVersion: '1.0',
    version: 'land-v1',
    crs: 'EPSG:4326',
    featureCount: 0
  },
  features: []
}

describe('#mapLandDataController', () => {
  let server
  let originalToken
  let fetchMock

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    originalToken = config.get('referenceData.token')
    config.set('referenceData.token', 'test-reference-data-token')
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (name) => (name.toLowerCase() === 'etag' ? '"land-v1"' : null)
      },
      json: async () => featureCollection
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    config.set('referenceData.token', originalToken)
  })

  test('Should proxy GeoJSON without exposing backend auth and preserve response headers', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/map-data/land'
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('application/geo+json')
    expect(response.headers.etag).toBe('"land-v1"')
    expect(response.result).toEqual(featureCollection)
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
      'Bearer test-reference-data-token'
    )
  })

  test('Should return 304 to the browser for a matching ETag', async () => {
    const first = await server.inject({ method: 'GET', url: '/map-data/land' })
    expect(first.statusCode).toBe(200)
    fetchMock.mockResolvedValueOnce({ status: 304 })

    const second = await server.inject({
      method: 'GET',
      url: '/map-data/land',
      headers: { 'if-none-match': '"land-v1"' }
    })

    expect(second.statusCode).toBe(304)
    expect(second.headers.etag).toBe('"land-v1"')
  })
})
