import { canonicalCatchRecord } from '#/test-helpers/canonical-catch-record.js'
import { submittedSummary } from './submitted-summary.js'

describe('Submitted record snapshot summary', () => {
  test('Should preserve distinct gear groups and zero weights with screenshot measurement labels', () => {
    const record = canonicalCatchRecord()
    const second = structuredClone(record.gears[0])
    second.gear.nameSnapshot = 'Second gear'
    second.characteristics[0].unitSnapshot = 'mm'
    record.gears.push(second)
    const original = structuredClone(record)
    const sections = submittedSummary(record)
    expect(sections.map((section) => section.heading)).toEqual([
      'Trips details',
      'Gear used',
      'Gear used',
      'Species caught',
      'Species caught',
      'Species not landed'
    ])
    expect(sections[1].rows[0].value.text).toBe('Test gear')
    expect(sections[2].rows[0].value.text).toBe('Second gear')
    expect(sections[1].startsGearSection).toBe(true)
    expect(sections[2].startsGearSection).toBe(false)
    expect(sections[2].gearName).toBe('Second gear')
    expect(sections[2].rows[3]).toEqual({
      key: { text: 'Length' },
      value: { text: 12 }
    })
    expect(sections[3].gearName).toBe('Test gear')
    expect(sections[4].gearName).toBe('Second gear')
    expect(sections[3].startsSpeciesSection).toBe(true)
    expect(sections[4].startsSpeciesSection).toBe(false)
    expect(sections[4].speciesName).toBe('Cod (COD)')
    expect(sections[4].rows[1].value.text).toBe(0)
    expect(record).toEqual(original)
  })

  test('Should show saved trip statistical areas and keep measurements and species weights associated with their own gear', () => {
    const record = canonicalCatchRecord()
    const second = structuredClone(record.gears[0])
    second.gear = { ...second.gear, id: 'gear-2', nameSnapshot: 'Second gear' }
    second.statisticalArea.codeSnapshot = '29E8'
    second.characteristics[0].value = 42
    second.speciesCaught[0].weightAboveMinimumKg = 99
    second.speciesCaught.push({
      id: 'species-2',
      nameSnapshot: 'Haddock',
      faoCodeSnapshot: 'HAD',
      weightAboveMinimumKg: 3,
      weightBelowMinimumKg: 0,
      weightLegallyDiscardedKg: 1
    })
    record.gears.push(second)
    const sections = submittedSummary(record)
    expect(sections[0].rows.map((row) => row.key.text)).toEqual([
      'Vessel',
      'Departure date',
      'Return date',
      'Departure port',
      'Return port',
      'Statistical sub area (Test gear)',
      'Statistical sub area (Second gear)'
    ])
    expect(sections[0].rows[5].value.text).toBe('30E5')
    expect(sections[0].rows[6].value.text).toBe('29E8')
    expect(sections[1].gearId).toBe('gear-1')
    expect(sections[2].gearId).toBe('gear-2')
    expect(sections[1].rows.map((row) => row.key.text)).toEqual([
      'Gear type',
      'Area majority catch caught',
      'Species caught',
      'Length'
    ])
    expect(sections[1].rows[1].value.text).toBe('30E5')
    expect(sections[2].rows[1].value.text).toBe('29E8')
    expect(sections[1].rows[2].value.text).toBe('Cod (COD)')
    expect(sections[2].rows[2].value.text).toBe('Cod (COD), Haddock (HAD)')
    expect(sections[1].rows[3].value.text).toBe(12)
    expect(sections[2].rows[3].value.text).toBe(42)
    expect(sections[3].rows).toHaveLength(3)
    expect(sections[4].rows).toHaveLength(3)
    expect(sections[5].rows).toHaveLength(3)
    expect(sections[3].rows[0].value.text).toBe(12.5)
    expect(sections[4].rows[0].value.text).toBe(99)
    expect(sections[5].speciesName).toBe('Haddock (HAD)')
    expect(sections[5].rows[0].value.text).toBe(3)
    expect(sections[5].gearId).toBe('gear-2')
    expect(sections[5].rows.map((row) => row.key.text)).toEqual([
      'Weight above minimum size retained (kg)',
      'Weight below minimum size retained (kg)',
      'Weight legally discarded (kg)'
    ])
  })

  test('Should show unavailable answers honestly and no unlanded species for an empty list', () => {
    const record = canonicalCatchRecord({ speciesNotLanded: [] })
    record.trip.dateStarted = null
    record.trip.departurePort = null
    record.gears[0].statisticalArea = null
    record.gears[0].speciesCaught[0].weightAboveMinimumKg = null
    const sections = submittedSummary(record)
    expect(sections[0].rows[1].value.text).toBe('Not entered')
    expect(sections[0].rows[3].value.text).toBe('Not entered')
    expect(sections[0].rows[5]).toEqual({
      key: { text: 'Statistical sub area' },
      value: { text: 'Not entered' }
    })
    expect(sections[2].rows[0].value.text).toBe('Not entered')
    expect(sections.at(-1).rows).toEqual([
      { key: { text: 'Not landed' }, value: { text: 'No' } }
    ])
  })
})
