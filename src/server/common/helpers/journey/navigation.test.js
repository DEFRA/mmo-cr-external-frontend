import {
  backForCheckAnswers,
  backForDeparturePort,
  backForSpeciesSelection,
  getJourneyState,
  resolveNextPath,
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

  test('Should restore current-route autosave values into the journey state', () => {
    const request = {
      path: '/trip-date',
      yar: {
        get: () => ({
          autosave: { path: '/trip-date', fields: { tripSameDate: 'no' } }
        }),
        set: () => {}
      }
    }

    expect(getJourneyState(request)).toEqual({
      autosave: { path: '/trip-date', fields: { tripSameDate: 'no' } },
      tripSameDate: false
    })
  })

  test('Should normalize checkbox, radio and split-date autosave values', () => {
    const fields = {
      tripSameDate: 'yes',
      gearIds: ['pots', 'trawl'],
      speciesIds: 'cod',
      'tripDepartureDate-day': '12',
      'tripDepartureDate-month': '4',
      'tripReturnDate-day': '13',
      'tripReturnDate-month': '4',
      departurePort: 'hastings'
    }
    const request = {
      path: '/trip-date',
      yar: {
        get: () => ({ autosave: { path: '/trip-date', fields } }),
        set: () => {}
      }
    }

    expect(getJourneyState(request)).toMatchObject({
      tripSameDate: true,
      selectedGearIds: ['pots', 'trawl'],
      selectedSpeciesIds: ['cod'],
      tripDepartureDate: { day: '12', month: '4' },
      tripReturnDate: { day: '13', month: '4' },
      departurePort: 'hastings'
    })
  })

  test('Should normalize a single gear checkbox value to an array', () => {
    const request = {
      path: '/gear-selection',
      yar: {
        get: () => ({
          autosave: { path: '/gear-selection', fields: { gearIds: 'pots' } }
        }),
        set: () => {}
      }
    }

    expect(getJourneyState(request).selectedGearIds).toEqual(['pots'])
  })

  test('Should return an empty state when the request has no session', () => {
    expect(getJourneyState()).toEqual({})
    expect(getJourneyState({})).toEqual({})
    expect(getJourneyState({ yar: { get: () => undefined } })).toEqual({})
  })

  test('Should ignore autosave values for a different route', () => {
    const request = {
      path: '/trip-departure-date',
      yar: {
        get: () => ({
          autosave: { path: '/trip-date', fields: { tripSameDate: 'yes' } }
        }),
        set: () => {}
      }
    }

    expect(getJourneyState(request)).toEqual({
      autosave: { path: '/trip-date', fields: { tripSameDate: 'yes' } }
    })
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

describe('#backForCheckAnswers', () => {
  test('Should return /species-not-landed when catch not landed is Yes', () => {
    const request = createFakeRequest({ catchNotLanded: true })
    expect(backForCheckAnswers(request)).toBe('/species-not-landed')
  })

  test('Should return /catch-not-landed by default', () => {
    const request = createFakeRequest(undefined)
    expect(backForCheckAnswers(request)).toBe('/catch-not-landed')
  })

  test('Should return /catch-not-landed when catch not landed is No', () => {
    const request = createFakeRequest({ catchNotLanded: false })
    expect(backForCheckAnswers(request)).toBe('/catch-not-landed')
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

describe('#resolveNextPath', () => {
  test('Should return the default path when no return query is present', () => {
    expect(resolveNextPath({ query: {} }, '/gear-selection')).toBe(
      '/gear-selection'
    )
  })

  test('Should return the default path when query is undefined', () => {
    expect(resolveNextPath({}, '/gear-selection')).toBe('/gear-selection')
  })

  test('Should use the default path when the return query is unsafe', () => {
    expect(
      resolveNextPath({ query: { return: '//external.example' } }, '/draft')
    ).toBe('/draft')
  })

  test('Should return a safe return path when supplied', () => {
    expect(
      resolveNextPath(
        { query: { return: '/check-answers' } },
        '/gear-selection'
      )
    ).toBe('/check-answers')
  })

  test('Should fall back to the default path for an unsafe return candidate', () => {
    expect(
      resolveNextPath(
        { query: { return: 'https://evil.example' } },
        '/gear-selection'
      )
    ).toBe('/gear-selection')
  })
})
