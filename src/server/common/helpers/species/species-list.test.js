import {
  findSpeciesOptionByLabel,
  getAvailableSpeciesIds,
  getSpeciesJourneyState,
  getSpeciesOptionsByIds
} from './species-list.js'

const catalogue = [
  { id: 'guid-cod', code: 'COD', text: 'Cod (COD)' },
  { id: 'guid-had', code: 'HAD', text: 'Haddock (HAD)' },
  { id: 'guid-mac', code: 'MAC', text: 'Mackerel (MAC)' }
]

describe('#getAvailableSpeciesIds', () => {
  test('Should return available favorite species IDs when journey state has no override', () => {
    expect(getAvailableSpeciesIds({}, catalogue)).toEqual([
      'guid-cod',
      'guid-had',
      'guid-mac'
    ])
  })

  test('Should return the journey state override when present', () => {
    expect(
      getAvailableSpeciesIds({ availableSpeciesIds: ['guid-cod'] }, catalogue)
    ).toEqual(['guid-cod'])
  })
})

describe('#getSpeciesOptionsByIds', () => {
  test('Should return only the species matching the given ids, in catalogue order', () => {
    const options = getSpeciesOptionsByIds(['guid-mac', 'guid-cod'], catalogue)

    expect(options.map((species) => species.id)).toEqual([
      'guid-cod',
      'guid-mac'
    ])
  })

  test('Should return an empty array when no ids match', () => {
    expect(getSpeciesOptionsByIds([], catalogue)).toEqual([])
  })
})

describe('#findSpeciesOptionByLabel', () => {
  test('Should find a species by its exact display text', () => {
    expect(findSpeciesOptionByLabel('Cod (COD)', catalogue)?.id).toBe(
      'guid-cod'
    )
  })

  test('Should match regardless of case or surrounding whitespace', () => {
    expect(findSpeciesOptionByLabel('  cod (cod)  ', catalogue)?.id).toBe(
      'guid-cod'
    )
  })

  test('Should return undefined for an empty label', () => {
    expect(findSpeciesOptionByLabel('', catalogue)).toBeUndefined()
  })

  test('Should return undefined for a whitespace-only label', () => {
    expect(findSpeciesOptionByLabel('   ', catalogue)).toBeUndefined()
  })

  test('Should return undefined when no label is supplied', () => {
    expect(findSpeciesOptionByLabel(undefined, catalogue)).toBeUndefined()
  })

  test('Should return undefined for an unrecognised label', () => {
    expect(
      findSpeciesOptionByLabel('Not a real species', catalogue)
    ).toBeUndefined()
  })
})

describe('#getSpeciesJourneyState', () => {
  test('Should migrate legacy FAO-code IDs and weight keys to backend GUIDs', () => {
    let state = {
      selectedSpeciesIds: ['cod'],
      availableSpeciesIds: ['cod', 'had'],
      speciesWeights: { cod: { weightAboveMinimum: 12 } },
      speciesNotLanded: { cod: { weightAboveMinimum: 4 } }
    }
    const request = {
      yar: {
        get: () => state,
        set: (_key, nextState) => {
          state = nextState
        }
      }
    }

    const migrated = getSpeciesJourneyState(request, catalogue)

    expect(migrated).toMatchObject({
      selectedSpeciesIds: ['guid-cod'],
      availableSpeciesIds: ['guid-cod', 'guid-had'],
      speciesWeights: { 'guid-cod': { weightAboveMinimum: 12 } },
      speciesNotLanded: { 'guid-cod': { weightAboveMinimum: 4 } }
    })
    expect(state).toEqual(migrated)
  })
})
