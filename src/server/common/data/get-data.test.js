import { getData } from './get-data.js'
import { allRecords } from './records.js'

describe('#getData', () => {
  test('Should return the service data', () => {
    expect(getData('service').name).toBe('Record your catch')
  })

  test('Should return the account data', () => {
    expect(getData('account').name).toBe('James Smith')
  })

  test('Should return one record per canonical status', () => {
    const records = getData('allRecords')

    expect(records).toHaveLength(4)
    expect(records.map((record) => record.status).sort()).toEqual(
      ['amended', 'late', 'submitted', 'unsent'].sort()
    )
  })

  test('Should return the catch record details data', () => {
    expect(getData('catchRecordDetails').vesselName).toBe('OLGA')
  })

  test('Should return the vessel name for select vessel', () => {
    expect(getData('selectVessel').name).toBe('OLGA')
  })

  test('Should return trip date examples', () => {
    expect(getData('tripDates').sameDateExample).toBeTruthy()
  })

  test('Should return ports including Hastings', () => {
    const ports = getData('ports')

    expect(ports).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Hastings' })])
    )
  })

  test('Should return gear options with exactly one implemented sublevel', () => {
    const gearOptions = getData('gearSelection')
    const implemented = gearOptions.filter(
      (option) => option.hasImplementedSublevel
    )

    expect(implemented).toHaveLength(1)
    expect(implemented[0].value).toBe('pots')
  })

  test('Should return pots details', () => {
    expect(getData('potsDetails')).toEqual({ potsHauled: 45, potsInWater: 12 })
  })

  test('Should return statistical areas with a primary and an Other entry', () => {
    const statisticalAreas = getData('statisticalAreas')

    expect(statisticalAreas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 'area-viid' }),
        expect.objectContaining({ value: 'other' })
      ])
    )
  })

  test('Should return the alternative statistical area example', () => {
    expect(getData('alternativeStatisticalAreaExample').value).toBe(
      'area-vii-other'
    )
  })

  test('Should return species selection with COD, HAD and SAL', () => {
    const speciesSelection = getData('speciesSelection')

    expect(speciesSelection.map((species) => species.code).sort()).toEqual(
      ['COD', 'HAD', 'SAL'].sort()
    )
  })

  test('Should return numeric species weights for COD', () => {
    const { COD } = getData('speciesWeights')

    expect(typeof COD.weightAboveMinimum).toBe('number')
    expect(typeof COD.weightBelowMinimum).toBe('number')
    expect(typeof COD.weightDiscarded).toBe('number')
  })

  test('Should return the default catch not landed answer', () => {
    expect(getData('catchNotLanded').defaultAnswer).toBe('no')
  })

  test('Should return a truthy confirmation reference', () => {
    expect(getData('confirmation').reference).toBeTruthy()
  })

  test('Should throw for an unknown key without leaking file paths', () => {
    expect(() => getData('doesNotExist')).toThrow(
      'Unknown mock-data key: doesNotExist'
    )

    try {
      getData('doesNotExist')
    } catch (error) {
      expect(error.message).not.toMatch(/\.js|\/src\/|\/Users\//)
    }
  })

  test('Should not let a mutated result affect later calls', () => {
    const firstResult = getData('allRecords')
    firstResult.push({ recordId: 'extra', status: 'unsent' })
    firstResult[0].status = 'changed'

    const secondResult = getData('allRecords')

    expect(secondResult).toHaveLength(4)
    expect(secondResult[0].status).toBe('submitted')
  })

  test('Should not let a mutated result affect the underlying source data', () => {
    const result = getData('allRecords')
    result.push({ recordId: 'extra', status: 'unsent' })
    result[0].status = 'changed'

    expect(allRecords).toHaveLength(4)
    expect(allRecords[0].status).toBe('submitted')
  })
})
