const { vesselsClient, clientOptions } = vi.hoisted(() => ({
  vesselsClient: {
    getVessels: vi.fn(),
    getVessel: vi.fn()
  },
  clientOptions: { value: undefined }
}))

vi.mock('#/server/common/clients/vessels-reference-data.js', () => ({
  createVesselsReferenceDataClient: vi.fn((options) => {
    clientOptions.value = options
    return vesselsClient
  })
}))

import { getVesselCatalogue, getVesselItem } from './vessels-list.js'

describe('vessels-list wrappers', () => {
  beforeEach(() => vi.clearAllMocks())

  test('Should return the vessel catalogue', async () => {
    const vessels = [{ id: 'vessel-id', name: 'Sea Spray' }]
    vesselsClient.getVessels.mockResolvedValue(vessels)

    expect(clientOptions.value.token()).toBeNull()
    await expect(getVesselCatalogue()).resolves.toBe(vessels)
  })

  test('Should translate catalogue failures to service unavailable', async () => {
    vesselsClient.getVessels.mockRejectedValue(new Error('network failure'))

    await expect(getVesselCatalogue()).rejects.toMatchObject({
      isBoom: true,
      output: { statusCode: 503 },
      message: 'Vessels reference data is temporarily unavailable'
    })
  })

  test('Should return a vessel by id', async () => {
    const vessel = { id: 'vessel-id', name: 'Sea Spray' }
    vesselsClient.getVessel.mockResolvedValue(vessel)

    await expect(getVesselItem('vessel-id')).resolves.toBe(vessel)
    expect(vesselsClient.getVessel).toHaveBeenCalledWith('vessel-id')
  })

  test('Should translate vessel lookup failures to service unavailable', async () => {
    vesselsClient.getVessel.mockRejectedValue(new Error('network failure'))

    await expect(getVesselItem('missing')).rejects.toMatchObject({
      isBoom: true,
      output: { statusCode: 503 },
      message: 'Vessels reference data is temporarily unavailable'
    })
  })
})
