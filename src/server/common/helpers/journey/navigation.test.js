import {
  backForCheckAnswers,
  backForDeparturePort,
  backForSpeciesSelection,
  getJourneyState,
  resolveNextPath,
  safeReturnPath,
  setJourneyState
} from './navigation.js'
import { config } from '#/config/config.js'

describe('Account favourite session isolation', () => {
  let enabled
  beforeEach(() => {
    enabled = config.get('catchRecording.enabled')
    config.set('catchRecording.enabled', true)
  })
  afterEach(() => config.set('catchRecording.enabled', enabled))

  test('Should not copy favourite IDs or measurement defaults when changing the trip vessel', () => {
    const sessions = {
      journey: { selectedVesselId: 'vessel-1' },
      vesselFavourites: {
        'vessel-1': {
          favouriteGearIds: ['gear-1'],
          favouriteGearMeasurements: { 'gear-1': { mesh: 12 } }
        },
        'vessel-2': { favouriteGearIds: ['gear-2'] }
      }
    }
    const request = {
      path: '/select-vessel',
      yar: {
        get: (key) => sessions[key],
        set: (key, value) => {
          sessions[key] = value
        }
      }
    }
    setJourneyState(request, { selectedVesselId: 'vessel-2' })
    expect(getJourneyState(request).favouriteGearIds).toEqual(['gear-2'])
    expect(getJourneyState(request).favouriteGearMeasurements).toBeUndefined()
    setJourneyState(request, { selectedVesselId: 'vessel-3' })
    expect(getJourneyState(request).favouriteGearIds).toBeUndefined()
    setJourneyState(request, { selectedVesselId: 'vessel-1' })
    expect(getJourneyState(request).favouriteGearMeasurements).toEqual({
      'gear-1': { mesh: 12 }
    })
    expect(sessions.vesselFavourites['vessel-2']).toEqual({
      favouriteGearIds: ['gear-2']
    })
  })

  test('Should keep interleaved account forms separate from each other and the trip', () => {
    const sessions = {
      journey: { selectedVesselId: 'trip-vessel', catchRecordId: 'trip-record' }
    }
    const yar = {
      get: (key) => sessions[key],
      set: (key, value) => {
        sessions[key] = value
      }
    }
    const first = {
      path: '/skipper-details',
      query: { vesselId: 'vessel-1' },
      yar
    }
    const second = { ...first, query: { vesselId: 'vessel-2' } }
    setJourneyState(first, { pendingSkipper: { firstName: 'First' } })
    setJourneyState(second, { pendingSkipper: { firstName: 'Second' } })
    expect(getJourneyState(first)).toEqual({
      selectedVesselId: 'vessel-1',
      pendingSkipper: { firstName: 'First' }
    })
    expect(getJourneyState(second)).toEqual({
      selectedVesselId: 'vessel-2',
      pendingSkipper: { firstName: 'Second' }
    })
    expect(sessions.journey).toEqual({
      selectedVesselId: 'trip-vessel',
      catchRecordId: 'trip-record'
    })
  })

  test.each(['', ' ', ['vessel-1', 'vessel-2'], 'a'.repeat(201)])(
    'Should reject invalid account vessel context %j',
    (vesselId) => {
      expect(() =>
        getJourneyState({ path: '/add-skipper', query: { vesselId } })
      ).toThrow('Select a valid vessel')
    }
  )

  test.each([
    ['/account', {}],
    ['/remove-port', {}],
    ['/skipper-details', {}],
    ['/add-port', { return: '/account' }],
    ['/add-gear', { return: '/account', step: 'measurements' }],
    ['/remove-gear', { return: '/account' }],
    ['/add-species', { return: '/account' }],
    ['/remove-species', { return: '/account' }]
  ])('Should isolate account reads and writes for %s', (path, query) => {
    const sessions = {
      journey: {
        selectedVesselId: 'trip-vessel',
        catchRecordId: 'trip-record'
      },
      accountJourney: { selectedVesselId: 'account-vessel' }
    }
    const request = {
      path,
      query,
      yar: {
        get: (key) => sessions[key],
        set: (key, value) => {
          sessions[key] = value
        }
      }
    }
    expect(getJourneyState(request).selectedVesselId).toBe('account-vessel')
    setJourneyState(request, { favouriteGearIds: ['gear-1'] })
    expect(
      sessions.vesselFavourites['account-vessel'].favouriteGearIds
    ).toEqual(['gear-1'])
    expect(sessions.accountJourney.favouriteGearIds).toBeUndefined()
    expect(
      getJourneyState({ ...request, path: '/gear-selection', query: {} })
        .favouriteGearIds
    ).toBeUndefined()
    expect(sessions.journey).toEqual({
      selectedVesselId: 'trip-vessel',
      catchRecordId: 'trip-record'
    })
  })

  test.each([
    ['/add-gear', {}],
    ['/add-species', { return: '/species-selection' }],
    ['/gear-selection', { return: '/account' }],
    ['/check-answers', {}]
  ])('Should keep trip forms on the active journey for %s', (path, query) => {
    const request = {
      path,
      query,
      yar: {
        get: (key) =>
          ({
            journey: { selectedVesselId: 'trip-vessel' },
            accountJourney: { selectedVesselId: 'account-vessel' }
          })[key]
      }
    }
    expect(getJourneyState(request).selectedVesselId).toBe('trip-vessel')
    config.set('catchRecording.enabled', false)
    request.path = '/account'
    expect(getJourneyState(request).selectedVesselId).toBe('trip-vessel')
  })
})

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
