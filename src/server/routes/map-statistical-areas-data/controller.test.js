import { createServer } from '#/server/server.js'
import { config } from '#/config/config.js'

const feature = {
  type: 'Feature',
  id: 'area-guid',
  properties: {
    id: 'area-guid',
    code: '27D86',
    name: 'ICES subrectangle 27D86'
  },
  geometry: { type: 'Polygon', coordinates: [] }
}
const collection = {
  type: 'FeatureCollection',
  metadata: { dataset: 'map-statistical-areas', featureCount: 1 },
  features: [feature]
}

describe('#mapStatisticalAreasData routes', () => {
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
    config.set('referenceData.token', 'test-read-token')
    fetchMock = vi.fn((url) =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => '"areas-v1"' },
        json: async () => (url.includes('/area-guid') ? feature : collection)
      })
    )
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    config.set('referenceData.token', originalToken)
  })

  test('Should proxy the collection as GeoJSON', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/map-data/statistical-areas?code=27D86'
    })
    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('application/geo+json')
    expect(response.headers.etag).toBe('"areas-v1"')
    expect(JSON.parse(response.payload).features[0].properties.code).toBe(
      '27D86'
    )
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
      'Bearer test-read-token'
    )
  })

  test('Should proxy a statistical-area item by GUID', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/map-data/statistical-areas/area-guid'
    })
    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.payload).id).toBe('area-guid')
  })
})
