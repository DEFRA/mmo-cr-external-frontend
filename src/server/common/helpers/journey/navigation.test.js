import {
  backForDeparturePort,
  backForSpeciesSelection,
  getJourneyState,
  safeReturnPath,
  setJourneyState
} from './navigation.js'

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

describe('#getJourneyState', () => {
  test('Should return an empty object when no journey state is stored', () => {
    const request = createFakeRequest(undefined)
    expect(getJourneyState(request)).toEqual({})
  })

  test('Should return the stored journey state', () => {
    const request = createFakeRequest({ tripSameDate: true })
    expect(getJourneyState(request)).toEqual({ tripSameDate: true })
  })
})

describe('#setJourneyState', () => {
  test('Should merge a patch into any existing journey state', () => {
    const request = createFakeRequest({ tripSameDate: true })
    setJourneyState(request, { statAreaBranch: 'other' })
    expect(getJourneyState(request)).toEqual({
      tripSameDate: true,
      statAreaBranch: 'other'
    })
  })
})

describe('#backForDeparturePort', () => {
  test('Should return /trip-date when the trip is on the same date', () => {
    const request = createFakeRequest({ tripSameDate: true })
    expect(backForDeparturePort(request)).toBe('/trip-date')
  })

  test('Should return /trip-date by default when unset', () => {
    const request = createFakeRequest(undefined)
    expect(backForDeparturePort(request)).toBe('/trip-date')
  })

  test('Should return /trip-return-date when the trip is on a different date', () => {
    const request = createFakeRequest({ tripSameDate: false })
    expect(backForDeparturePort(request)).toBe('/trip-return-date')
  })
})

describe('#backForSpeciesSelection', () => {
  test('Should return /statistical-area by default', () => {
    const request = createFakeRequest(undefined)
    expect(backForSpeciesSelection(request)).toBe('/statistical-area')
  })

  test('Should return /statistical-area-other when that branch was taken', () => {
    const request = createFakeRequest({ statAreaBranch: 'other' })
    expect(backForSpeciesSelection(request)).toBe('/statistical-area-other')
  })
})

describe('#safeReturnPath', () => {
  test('Should return a known internal path unchanged', () => {
    expect(safeReturnPath('/account')).toBe('/account')
  })

  test('Should fall back to /records for an unknown internal-looking path', () => {
    expect(safeReturnPath('/not-a-real-route')).toBe('/records')
  })

  test('Should fall back to /records for an absolute external URL', () => {
    expect(safeReturnPath('https://evil.example')).toBe('/records')
  })

  test('Should fall back to /records for a protocol-relative URL', () => {
    expect(safeReturnPath('//evil.example')).toBe('/records')
  })

  test('Should fall back to /records when no candidate is supplied', () => {
    expect(safeReturnPath(undefined)).toBe('/records')
  })
})
