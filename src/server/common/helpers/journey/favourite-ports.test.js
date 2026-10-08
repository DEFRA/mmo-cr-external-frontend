const { portsClient, clientOptions } = vi.hoisted(() => ({
  portsClient: {
    getPorts: vi.fn(),
    getPort: vi.fn()
  },
  clientOptions: { value: undefined }
}))

vi.mock('#/server/common/clients/ports-reference-data.js', () => ({
  createPortsReferenceDataClient: vi.fn((options) => {
    clientOptions.value = options
    return portsClient
  })
}))

import {
  addFavouritePortCode,
  getFavouritePortCodes
} from './favourite-ports.js'
import {
  findPortByName,
  getPortCatalogue,
  getPortItem,
  findPortByCode,
  migratePortJourneyState,
  portSearchLabel,
  rememberPortName
} from '#/server/common/helpers/ports/ports-list.js'

function createFakeRequest(initialState) {
  let state = initialState
  return {
    yar: {
      get: () => state,
      set: (_key, value) => {
        state = value
      }
    }
  }
}

describe('#getFavouritePortCodes', () => {
  test('Should return an empty array when no favourite ports are stored', () => {
    const request = createFakeRequest(undefined)
    expect(getFavouritePortCodes(request)).toEqual([])
  })

  test('Should return the stored favourite port codes', () => {
    const request = createFakeRequest({ favouritePorts: ['GB000123'] })
    expect(getFavouritePortCodes(request)).toEqual(['GB000123'])
  })
})

describe('#addFavouritePortCode', () => {
  test('Should add a new code to an empty list', () => {
    const request = createFakeRequest(undefined)
    const result = addFavouritePortCode(request, 'GB000123')

    expect(result).toEqual(['GB000123'])
    expect(getFavouritePortCodes(request)).toEqual(['GB000123'])
  })

  test('Should append a new code to an existing list', () => {
    const request = createFakeRequest({ favouritePorts: ['GB000123'] })
    const result = addFavouritePortCode(request, 'GB000456')

    expect(result).toEqual(['GB000123', 'GB000456'])
  })

  test('Should return the existing list unchanged when the code is already present', () => {
    const request = createFakeRequest({ favouritePorts: ['GB000123'] })
    const result = addFavouritePortCode(request, 'GB000123')

    expect(result).toEqual(['GB000123'])
    expect(getFavouritePortCodes(request)).toEqual(['GB000123'])
  })
})

describe('#migratePortJourneyState', () => {
  const catalogue = [
    {
      code: 'GBPLY',
      name: 'Plymouth',
      coordinate: { longitude: -4.1427, latitude: 50.3661 }
    },
    { code: 'GB007', name: 'Newlyn' }
  ]

  test('Should migrate unique legacy slugs to canonical codes without dropping unknown values', () => {
    const request = createFakeRequest({
      favouritePorts: ['plymouth', 'GBPLY', 'hastings'],
      departurePort: 'plymouth',
      returnPort: 'hastings'
    })

    const state = migratePortJourneyState(request, catalogue)

    expect(state.favouritePorts).toEqual(['GBPLY', 'hastings'])
    expect(state.departurePort).toBe('GBPLY')
    expect(state.returnPort).toBe('hastings')
    expect(state.portNamesByCode.GBPLY).toBe('Plymouth')
    expect(state.portCoordinatesByCode.GBPLY).toEqual([-4.1427, 50.3661])
  })

  test('Should reject an ambiguous or unknown slug', () => {
    expect(findPortByCode('hastings', catalogue)).toBeUndefined()
    expect(
      findPortByCode('plymouth', [
        ...catalogue,
        { code: 'GBOTHER', name: 'Plymouth' }
      ])
    ).toBeUndefined()
  })

  test('Should leave state unchanged when there is nothing to migrate', () => {
    const initialState = { favouritePorts: ['GB007'] }
    const request = createFakeRequest(initialState)

    expect(migratePortJourneyState(request, catalogue)).toBe(initialState)
  })

  test('Should add a port name without coordinates when the catalogue has none', () => {
    const request = createFakeRequest({ departurePort: 'GB007' })

    const state = migratePortJourneyState(request, catalogue)

    expect(state.portNamesByCode.GB007).toBe('Newlyn')
    expect(state.portCoordinatesByCode).toBeUndefined()
  })

  test('Should replace a stale stored port name without duplicating its coordinates', () => {
    const coordinates = [-4.1427, 50.3661]
    const request = createFakeRequest({
      departurePort: 'GBPLY',
      portNamesByCode: { GBPLY: 'Old name' },
      portCoordinatesByCode: { GBPLY: coordinates }
    })

    const state = migratePortJourneyState(request, catalogue)

    expect(state.portNamesByCode.GBPLY).toBe('Plymouth')
    expect(state.portCoordinatesByCode.GBPLY).toBe(coordinates)
  })

  test('Should distinguish approved ports sharing a name by exact code', () => {
    const ports = [
      { code: 'GB001', name: 'Example' },
      { code: 'GB002', name: 'Example' }
    ]

    expect(portSearchLabel(ports[0], ports)).toBe('Example (GB001)')
    expect(findPortByName('Example', ports)).toBeUndefined()
    expect(findPortByName('Example (GB002)', ports)).toBe(ports[1])
  })

  test('Should find a unique port name without case sensitivity or surrounding whitespace', () => {
    expect(findPortByName('  PLYMOUTH  ', catalogue)).toBe(catalogue[0])
    expect(portSearchLabel(catalogue[0], catalogue)).toBe('Plymouth')
  })
})

describe('reference data wrappers', () => {
  test('Should provide the token through a lazy configuration lookup', () => {
    expect(() => clientOptions.value.token()).not.toThrow()
  })

  test('Should return the port catalogue', async () => {
    const ports = [{ code: 'GBPLY', name: 'Plymouth' }]
    portsClient.getPorts.mockResolvedValue(ports)

    await expect(getPortCatalogue()).resolves.toBe(ports)
  })

  test('Should report the catalogue as unavailable when fetching fails', async () => {
    portsClient.getPorts.mockRejectedValue(new Error('network failure'))

    await expect(getPortCatalogue()).rejects.toThrow(
      'Ports reference data is temporarily unavailable'
    )
  })

  test('Should return a port by id', async () => {
    const port = { code: 'GBPLY', name: 'Plymouth' }
    portsClient.getPort.mockResolvedValue(port)

    await expect(getPortItem('port-id')).resolves.toBe(port)
  })

  test('Should report a port as unavailable when fetching by id fails', async () => {
    portsClient.getPort.mockRejectedValue(new Error('network failure'))

    await expect(getPortItem('port-id')).rejects.toThrow(
      'Ports reference data is temporarily unavailable'
    )
  })
})

describe('#rememberPortName', () => {
  test('Should store API port coordinates for the statistical-area map', () => {
    const request = createFakeRequest({})
    rememberPortName(request, {
      code: 'GBHUL',
      name: 'Hull',
      coordinate: { longitude: -0.333, latitude: 53.717 }
    })

    expect(request.yar.get().portNamesByCode.GBHUL).toBe('Hull')
    expect(request.yar.get().portCoordinatesByCode.GBHUL).toEqual([
      -0.333, 53.717
    ])
  })

  test('Should store a port name without invalid coordinates', () => {
    const request = createFakeRequest({})
    rememberPortName(request, {
      code: 'GBHUL',
      name: 'Hull',
      coordinate: { longitude: Number.NaN, latitude: 53.717 }
    })

    expect(request.yar.get().portNamesByCode.GBHUL).toBe('Hull')
    expect(request.yar.get().portCoordinatesByCode).toBeUndefined()
  })
})
