import {
  backForCheckAnswers,
  backForStatisticalArea,
  catchDetailsForSelectedGears,
  currentGearId,
  gearPageContext,
  gearPath,
  getGearJourneyState,
  getJourneyState,
  incompleteGearPath,
  nextAfterGear,
  setGearJourneyState
} from './navigation.js'

function requestFor(state, query = {}) {
  let stored = state
  return {
    query,
    yar: {
      get: () => stored,
      set: (_key, value) => {
        stored = value
      }
    }
  }
}

const completeAnswers = {
  statAreaBranch: 'direct',
  selectedStatisticalArea: '38E95',
  selectedSpeciesIds: ['cod'],
  speciesWeights: { cod: { weightAboveMinimum: 15 } }
}

describe('gear-scoped catch answers', () => {
  test('isolates writes and retains shared trip details', () => {
    const request = requestFor(
      {
        departurePort: 'GBPLY',
        selectedGearIds: ['pots', 'dredge'],
        catchDetailsByGearId: { pots: completeAnswers }
      },
      { gearId: 'dredge' }
    )
    expect(getGearJourneyState(request).selectedSpeciesIds).toBeUndefined()
    setGearJourneyState(request, { selectedStatisticalArea: '38E96' })
    expect(getJourneyState(request).catchDetailsByGearId.pots).toEqual(
      completeAnswers
    )
    expect(getGearJourneyState(request).departurePort).toBe('GBPLY')
    expect(getGearJourneyState(request).selectedStatisticalArea).toBe('38E96')
  })

  test('rejects unknown, removed and repeated gear query values', () => {
    for (const gearId of ['unknown', ['pots', 'dredge']]) {
      const request = requestFor({ selectedGearIds: ['pots'] }, { gearId })
      expect(() => currentGearId(request)).toThrow(
        'Select a gear used on this trip'
      )
    }
  })

  test('migrates single-gear legacy answers without assigning multi-gear answers', () => {
    const single = requestFor({ selectedGearIds: ['pots'], ...completeAnswers })
    expect(getGearJourneyState(single).speciesWeights).toEqual(
      completeAnswers.speciesWeights
    )
    expect(catchDetailsForSelectedGears(single, ['pots', 'dredge'])).toEqual({
      pots: completeAnswers
    })
    const multiple = requestFor({
      selectedGearIds: ['pots', 'dredge'],
      ...completeAnswers
    })
    expect(getGearJourneyState(multiple).speciesWeights).toBeUndefined()
    expect(gearPageContext(multiple).legacyCatchNotice).toContain(
      'have not been copied'
    )
    expect(catchDetailsForSelectedGears(multiple, ['pots'])).toEqual({})
  })

  test('does not reuse old trip-level answers for a newly selected gear', () => {
    const request = requestFor({
      selectedGearIds: ['dredge'],
      catchDetailsByGearId: {},
      ...completeAnswers
    })
    expect(getGearJourneyState(request).selectedStatisticalArea).toBeUndefined()
  })

  test('prunes removed gear answers', () => {
    const request = requestFor({
      selectedGearIds: ['pots', 'dredge'],
      catchDetailsByGearId: { pots: completeAnswers, dredge: completeAnswers }
    })
    expect(catchDetailsForSelectedGears(request, ['dredge'])).toEqual({
      dredge: completeAnswers
    })
  })

  test('builds scoped paths and leaves external or shared paths untouched', () => {
    const request = requestFor({ selectedGearIds: ['pots'] })
    expect(
      gearPath(request, '/species-selection', undefined, '/check-answers')
    ).toBe('/species-selection?gearId=pots&return=/check-answers')
    expect(gearPath(request, '/gear-selection')).toBe('/gear-selection')
    expect(gearPath(request, null)).toBeNull()
  })

  test('navigates forwards and backwards across gear boundaries', () => {
    const request = requestFor(
      {
        selectedGearIds: ['pots', 'dredge'],
        catchNotLanded: false,
        catchDetailsByGearId: {
          pots: completeAnswers,
          dredge: completeAnswers
        }
      },
      { gearId: 'pots' }
    )
    expect(backForStatisticalArea(request)).toBe('/gear-selection')
    expect(nextAfterGear(request)).toBe('/statistical-area?gearId=dredge')
    request.query.gearId = 'dredge'
    expect(backForStatisticalArea(request)).toBe(
      '/species-selection?gearId=pots'
    )
    expect(nextAfterGear(request)).toBe('/catch-not-landed')
    expect(backForCheckAnswers(request)).toBe('/catch-not-landed')
    request.query = { gearId: 'pots', return: '/check-answers' }
    expect(nextAfterGear(request)).toBe('/check-answers')
  })

  test.each([
    [{}, '/statistical-area'],
    [
      { selectedStatisticalArea: 'other', statAreaBranch: 'other' },
      '/statistical-area-other'
    ],
    [
      {
        selectedStatisticalArea: 'other',
        statAreaBranch: 'other',
        selectedAlternativeAreaOption: 'other'
      },
      '/statistical-area-other'
    ],
    [{ selectedStatisticalArea: '38E95' }, '/species-selection'],
    [{ ...completeAnswers, speciesWeights: {} }, '/species-selection']
  ])('finds the first missing answer %#', (answers, path) => {
    const request = requestFor({
      selectedGearIds: ['pots'],
      catchDetailsByGearId: { pots: answers }
    })
    expect(incompleteGearPath(request)).toBe(`${path}?gearId=pots`)
  })

  test('requires a gear when all gears have been removed', () => {
    expect(incompleteGearPath(requestFor({ selectedGearIds: [] }))).toBe(
      '/gear-selection'
    )
  })

  test('checks shared unlanded answers only after every gear has catch answers', () => {
    const state = {
      selectedGearIds: ['pots', 'dredge'],
      catchDetailsByGearId: { pots: completeAnswers, dredge: completeAnswers }
    }
    expect(incompleteGearPath(requestFor(state))).toBe('/catch-not-landed')
    expect(
      incompleteGearPath(requestFor({ ...state, catchNotLanded: true }))
    ).toBe('/species-not-landed')
    expect(
      incompleteGearPath(
        requestFor({
          ...state,
          catchNotLanded: true,
          speciesNotLanded: { haddock: { weightAboveMinimum: 1 } }
        })
      )
    ).toBe('/species-not-landed')
    expect(
      incompleteGearPath(
        requestFor({
          ...state,
          catchNotLanded: true,
          speciesNotLanded: { cod: { weightAboveMinimum: 1 } }
        })
      )
    ).toBeNull()
  })
})
