import {
  getFavouriteGearIds,
  migrateGearJourneyState
} from './favourite-gear.js'
import { config } from '#/config/config.js'

function createRequest(state) {
  let journeyState = state
  return {
    yar: {
      get: () => journeyState,
      set: (_key, value) => {
        journeyState = value
      }
    }
  }
}

describe('#gear favourite reference migration', () => {
  const catalogue = [
    { id: 'api-guid-1', code: 'OTB', name: 'Otter trawl' },
    { id: 'api-guid-2', code: 'GNS', name: 'Miscellaneous gear (diving)' }
  ]

  test('Should migrate unique legacy gear labels to API IDs', () => {
    const request = createRequest({
      favouriteGearIds: ['miscellaneous-gear-diving'],
      selectedGearIds: ['miscellaneous-gear-diving'],
      catchDetailsByGearId: {
        'miscellaneous-gear-diving': { selectedStatisticalArea: '38E95' }
      },
      gearMeasurementDetails: { 'miscellaneous-gear-diving': {} }
    })

    const state = migrateGearJourneyState(request, catalogue)

    expect(state.favouriteGearIds).toEqual(['api-guid-2'])
    expect(state.selectedGearIds).toEqual(['api-guid-2'])
    expect(getFavouriteGearIds(state, catalogue)).toEqual(['api-guid-2'])
    expect(state.catchDetailsByGearId).toEqual({
      'api-guid-2': { selectedStatisticalArea: '38E95' }
    })
    expect(state.gearMeasurementDetails).toEqual({ 'api-guid-2': {} })
  })

  test('Should not expose unknown saved IDs as valid API gears', () => {
    const request = createRequest({ favouriteGearIds: ['removed-static-gear'] })
    const state = migrateGearJourneyState(request, catalogue)

    expect(getFavouriteGearIds(state, catalogue)).toEqual([])
  })

  test('Should return no favourites when none have been saved', () => {
    expect(getFavouriteGearIds({}, catalogue)).toEqual([])
  })

  test('Should not silently discard saved gear selections in live mode', () => {
    const enabled = config.get('catchRecording.enabled')
    config.set('catchRecording.enabled', true)
    try {
      const request = createRequest({
        selectedGearIds: ['api-guid-1', 'retired-gear']
      })
      expect(() => migrateGearJourneyState(request, catalogue)).toThrow(
        'A saved gear is no longer available'
      )
      expect(request.yar.get()).toEqual({
        selectedGearIds: ['api-guid-1', 'retired-gear']
      })
    } finally {
      config.set('catchRecording.enabled', enabled)
    }
  })
})
