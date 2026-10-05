import { createMapStatisticalAreasReferenceDataClient } from './map-statistical-areas-reference-data.js'

const feature = {
  type: 'Feature',
  id: 'area-guid',
  properties: {
    id: 'area-guid',
    code: '27D86',
    name: 'ICES subrectangle 27D86',
    areaType: 'ices-subrectangle',
    centroid: { longitude: -4.5, latitude: 50.25 }
  },
  geometry: { type: 'Polygon', coordinates: [] }
}
const collection = {
  type: 'FeatureCollection',
  metadata: { dataset: 'map-statistical-areas', featureCount: 1 },
  features: [feature]
}

function response(body, etag = '"areas-v1"') {
  return {
    ok: true,
    status: 200,
    headers: { get: (name) => (name.toLowerCase() === 'etag' ? etag : null) },
    json: async () => body
  }
}

describe('#createMapStatisticalAreasReferenceDataClient', () => {
  test('Should fetch and cache a filtered GeoJSON collection', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(response(collection))
      .mockResolvedValueOnce({ status: 304 })
    const client = createMapStatisticalAreasReferenceDataClient({
      serviceUrl: 'http://localhost:3002',
      token: 'read-token',
      fetchFn
    })

    const first = await client.getCollection({ code: '27D86' })
    const second = await client.getCollection({ code: '27D86' })

    expect(first.body.features).toEqual([feature])
    expect(second).toBe(first)
    expect(fetchFn.mock.calls[0][0]).toContain(
      '/map/statistical-areas?code=27D86'
    )
    expect(fetchFn.mock.calls[1][1].headers['If-None-Match']).toBe('"areas-v1"')
  })

  test('Should fetch an item by GUID and propagate 404', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(response(feature))
      .mockResolvedValueOnce({ ok: false, status: 404 })
    const client = createMapStatisticalAreasReferenceDataClient({
      serviceUrl: 'http://localhost:3002',
      token: 'read-token',
      fetchFn
    })

    expect((await client.getFeature('area-guid')).feature).toEqual(feature)
    expect(fetchFn.mock.calls[0][0]).toContain(
      '/map/statistical-areas/area-guid'
    )
    await expect(client.getFeature('missing')).rejects.toMatchObject({
      statusCode: 404
    })
  })

  test('Should fail closed without a token', async () => {
    const fetchFn = vi.fn()
    const client = createMapStatisticalAreasReferenceDataClient({
      serviceUrl: 'http://localhost:3002',
      fetchFn
    })
    await expect(client.getCollection()).rejects.toThrow('not configured')
    expect(fetchFn).not.toHaveBeenCalled()
  })
})
