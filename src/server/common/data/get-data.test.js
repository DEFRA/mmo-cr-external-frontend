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

  test('Should return gear options with exactly one option requiring pots details', () => {
    const gearOptions = getData('gearSelection')
    const requiresPots = gearOptions.filter(
      (option) => option.requiresPotsDetails
    )

    expect(gearOptions).toHaveLength(9)
    expect(requiresPots).toHaveLength(1)
    expect(requiresPots[0].id).toBe('pots')
  })

  test('Should return gear options with unique stable ids', () => {
    const gearOptions = getData('gearSelection')
    const ids = gearOptions.map((option) => option.id)

    expect(new Set(ids).size).toBe(ids.length)
  })

  test('Should return pots details', () => {
    expect(getData('potsDetails')).toEqual({ potsHauled: 45, potsInWater: 12 })
  })

  test('Should return nearby statistical areas with unique stable ids', () => {
    const nearbyStatisticalAreas = getData('nearbyStatisticalAreas')
    const ids = nearbyStatisticalAreas.map((area) => area.id)

    expect(nearbyStatisticalAreas).toHaveLength(11)
    expect(new Set(ids).size).toBe(ids.length)
    expect(nearbyStatisticalAreas.map((area) => area.code)).toContain('38F02')
  })

  test('Should return 8 statistical areas with unique stable ids', () => {
    const statisticalAreas = getData('statisticalAreas')
    const ids = statisticalAreas.map((area) => area.id)

    expect(statisticalAreas).toHaveLength(8)
    expect(new Set(ids).size).toBe(ids.length)
    expect(statisticalAreas.map((area) => area.code)).toContain('30F02')
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
