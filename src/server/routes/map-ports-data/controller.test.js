import { createServer } from '#/server/server.js'
import { config } from '#/config/config.js'

const featureCollection = {
  type: 'FeatureCollection',
  metadata: {
    dataset: 'map-ports',
    sourceDataset: 'ports',
    version: 'ports-v1',
    crs: 'EPSG:4326',
    featureCount: 0
  },
  features: []
}

describe('#mapPortsDataController', () => {
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
        get: (name) => (name.toLowerCase() === 'etag' ? '"ports-v1"' : null)
      },
      json: async () => featureCollection
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    config.set('referenceData.token', originalToken)
  })

  test('Should proxy map ports GeoJSON without exposing backend auth', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/map-data/ports'
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('application/geo+json')
    expect(response.headers.etag).toBe('"ports-v1"')
    expect(response.result).toEqual(featureCollection)
    expect(fetchMock.mock.calls[0][0]).toMatch(
      /\/api\/v1\/reference-data\/map\/ports$/
    )
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
      'Bearer test-reference-data-token'
    )
  })

  test('Should return 304 to the browser for a matching ETag', async () => {
    await server.inject({ method: 'GET', url: '/map-data/ports' })
    fetchMock.mockResolvedValueOnce({ status: 304 })

    const response = await server.inject({
      method: 'GET',
      url: '/map-data/ports',
      headers: { 'if-none-match': '"ports-v1"' }
    })

    expect(response.statusCode).toBe(304)
    expect(response.headers.etag).toBe('"ports-v1"')
  })
})
