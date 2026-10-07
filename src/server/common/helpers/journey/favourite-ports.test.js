import {
  addFavouritePortCode,
  getFavouritePortCodes
} from './favourite-ports.js'
import {
  findPortByCode,
  findPortByName,
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

  test('Should distinguish approved ports sharing a name by exact code', () => {
    const ports = [
      { code: 'GB001', name: 'Example' },
      { code: 'GB002', name: 'Example' }
    ]

    expect(portSearchLabel(ports[0], ports)).toBe('Example (GB001)')
    expect(findPortByName('Example', ports)).toBeUndefined()
    expect(findPortByName('Example (GB002)', ports)).toBe(ports[1])
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
})
