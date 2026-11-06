import { createGeoJsonProxyController } from './geojson-proxy-controller.js'

describe('#createGeoJsonProxyController', () => {
  test('Should return 503 without leaking the upstream error', async () => {
    const controller = createGeoJsonProxyController({
      loadLayer: vi.fn().mockRejectedValue(new Error('secret upstream detail')),
      unavailableMessage: 'Layer is temporarily unavailable'
    })

    await expect(controller.handler({ headers: {} }, {})).rejects.toMatchObject(
      {
        isBoom: true,
        output: { statusCode: 503 },
        message: 'Layer is temporarily unavailable'
      }
    )
  })
})
