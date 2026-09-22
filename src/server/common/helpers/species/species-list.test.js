import {
  findSpeciesOptionByLabel,
  getAvailableSpeciesIds,
  getSpeciesCatalogue,
  getSpeciesOptionsByIds
} from './species-list.js'

describe('#getSpeciesCatalogue', () => {
  test('Should return species ordered by displayOrder', () => {
    const catalogue = getSpeciesCatalogue()
    const displayOrders = catalogue.map((species) => species.displayOrder)

    expect(displayOrders).toEqual([...displayOrders].sort((a, b) => a - b))
  })
})

describe('#getAvailableSpeciesIds', () => {
  test('Should return the default 3 species ids when journey state is empty', () => {
    expect(getAvailableSpeciesIds({})).toEqual(['cod', 'had', 'sal'])
  })

  test('Should return the journey state override when present', () => {
    expect(
      getAvailableSpeciesIds({ availableSpeciesIds: ['cod', 'ple'] })
    ).toEqual(['cod', 'ple'])
  })
})

describe('#getSpeciesOptionsByIds', () => {
  test('Should return only the species matching the given ids, in catalogue order', () => {
    const options = getSpeciesOptionsByIds(['sal', 'cod'])

    expect(options.map((species) => species.id)).toEqual(['cod', 'sal'])
  })

  test('Should return an empty array when no ids match', () => {
    expect(getSpeciesOptionsByIds([])).toEqual([])
  })
})

describe('#findSpeciesOptionByLabel', () => {
  test('Should find a species by its exact display text', () => {
    expect(findSpeciesOptionByLabel('Atlantic cod (COD)')?.id).toBe('cod')
  })

  test('Should match regardless of case or surrounding whitespace', () => {
    expect(findSpeciesOptionByLabel('  atlantic cod (cod)  ')?.id).toBe('cod')
  })

  test('Should return undefined for an empty label', () => {
    expect(findSpeciesOptionByLabel('')).toBeUndefined()
  })

  test('Should return undefined for a whitespace-only label', () => {
    expect(findSpeciesOptionByLabel('   ')).toBeUndefined()
  })

  test('Should return undefined when no label is supplied', () => {
    expect(findSpeciesOptionByLabel(undefined)).toBeUndefined()
  })

  test('Should return undefined for an unrecognised label', () => {
    expect(findSpeciesOptionByLabel('Not a real species')).toBeUndefined()
  })
})
