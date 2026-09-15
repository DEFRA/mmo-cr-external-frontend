import {
  ERROR_SUMMARY_TITLE,
  filterKnownSpeciesIds,
  noSpeciesSelectedError,
  normalizeSpeciesIds,
  speciesNameAndId,
  speciesNameOnly
} from './species-form.js'

describe('#speciesNameOnly', () => {
  test('Should strip the trailing species code suffix', () => {
    expect(speciesNameOnly('Atlantic cod (COD)')).toBe('Atlantic cod')
  })

  test('Should leave text unchanged when there is no suffix', () => {
    expect(speciesNameOnly('Atlantic cod')).toBe('Atlantic cod')
  })
})

describe('#speciesNameAndId', () => {
  test('Should build a lower-cased name and id string', () => {
    expect(speciesNameAndId({ text: 'Atlantic cod (COD)' }, 'cod')).toBe(
      'atlantic cod (cod)'
    )
  })
})

describe('#normalizeSpeciesIds', () => {
  test('Should return an empty array when the value is undefined', () => {
    expect(normalizeSpeciesIds(undefined)).toEqual([])
  })

  test('Should return an empty array when the value is an empty string', () => {
    expect(normalizeSpeciesIds('')).toEqual([])
  })

  test('Should wrap a single string value in an array', () => {
    expect(normalizeSpeciesIds('cod')).toEqual(['cod'])
  })

  test('Should return an array value unchanged', () => {
    expect(normalizeSpeciesIds(['cod', 'had'])).toEqual(['cod', 'had'])
  })
})

describe('#noSpeciesSelectedError', () => {
  test('Should build an error summary and field error for speciesIds', () => {
    expect(noSpeciesSelectedError()).toEqual({
      errorSummary: {
        titleText: ERROR_SUMMARY_TITLE,
        errorList: [
          { text: 'Select at least one species', href: '#speciesIds' }
        ]
      },
      fieldErrors: { speciesIds: 'Select at least one species' }
    })
  })
})

describe('#filterKnownSpeciesIds', () => {
  const speciesOptions = [{ id: 'cod' }, { id: 'had' }]

  test('Should keep ids that match a known species option', () => {
    expect(filterKnownSpeciesIds(['cod', 'had'], speciesOptions)).toEqual([
      'cod',
      'had'
    ])
  })

  test('Should drop ids that do not match any known species option', () => {
    expect(filterKnownSpeciesIds(['cod', 'mon'], speciesOptions)).toEqual([
      'cod'
    ])
  })

  test('Should return an empty array when no ids match', () => {
    expect(filterKnownSpeciesIds(['mon'], speciesOptions)).toEqual([])
  })
})
