import {
  getFavouriteGearIds,
  migrateGearJourneyState
} from './favourite-gear.js'

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
      selectedGearIds: ['miscellaneous-gear-diving']
    })

    const state = migrateGearJourneyState(request, catalogue)

    expect(state.favouriteGearIds).toEqual(['api-guid-2'])
    expect(state.selectedGearIds).toEqual(['api-guid-2'])
    expect(getFavouriteGearIds(state, catalogue)).toEqual(['api-guid-2'])
  })

  test('Should not expose unknown saved IDs as valid API gears', () => {
    const request = createRequest({ favouriteGearIds: ['removed-static-gear'] })
    const state = migrateGearJourneyState(request, catalogue)

    expect(getFavouriteGearIds(state, catalogue)).toEqual([])
  })

  test('Should use only legacy defaults that match active API names uniquely', () => {
    expect(getFavouriteGearIds({}, catalogue)).toEqual(['api-guid-2'])
  })
})
