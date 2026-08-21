import { buildCheckAnswersViewModel } from './view-model.js'
import { getData } from '#/server/common/data/get-data.js'

function fakeRequest(journeyState) {
  return { yar: { get: () => journeyState } }
}

function rowsFor(viewModel, heading) {
  return viewModel.sections.find((section) => section.heading === heading).rows
}

function rowValue(rows, keyText) {
  return rows.find((row) => row.key.text === keyText).value.text
}

function rowChangeHref(rows, keyText) {
  return rows.find((row) => row.key.text === keyText).actions.items[0].href
}

describe('#buildCheckAnswersViewModel', () => {
  test('Should produce all four sections in PNG order when no journey state exists', () => {
    const viewModel = buildCheckAnswersViewModel(fakeRequest(undefined))

    expect(viewModel.sections.map((section) => section.heading)).toEqual([
      'Trips details',
      'Gear used',
      'Species caught',
      'Species not landed'
    ])
  })

  test('Should fall back to the illustrative example values when no journey state exists', () => {
    const fallback = getData('catchRecordDetails')
    const viewModel = buildCheckAnswersViewModel(fakeRequest(undefined))
    const tripsRows = rowsFor(viewModel, 'Trips details')

    expect(rowValue(tripsRows, 'Vessel')).toBe('OLGA')
    expect(rowValue(tripsRows, 'Departure date')).toBe('22 July 2026')
    expect(rowValue(tripsRows, 'Return date')).toBe('22 July 2026')
    expect(rowValue(tripsRows, 'Departure port')).toBe(fallback.departurePort)
    expect(rowValue(tripsRows, 'Statistical sub area')).toBe(
      fallback.statisticalSubArea
    )
  })

  test('Should source Trips details rows from real journey state when present', () => {
    const viewModel = buildCheckAnswersViewModel(
      fakeRequest({
        tripSameDate: false,
        departureDate: '2026-06-10',
        returnDate: '2026-06-12',
        departurePort: 'newhaven',
        returnPort: 'rye',
        statAreaBranch: 'direct',
        selectedStatisticalArea: '38e95'
      })
    )
    const rows = rowsFor(viewModel, 'Trips details')

    expect(rowValue(rows, 'Departure date')).toBe('10 June 2026')
    expect(rowValue(rows, 'Return date')).toBe('12 June 2026')
    expect(rowValue(rows, 'Departure port')).toBe('Newhaven')
    expect(rowValue(rows, 'Return port')).toBe('Rye')
    expect(rowValue(rows, 'Statistical sub area')).toBe('38E95')
    expect(rowChangeHref(rows, 'Departure date')).toBe(
      '/trip-departure-date?return=/check-answers'
    )
  })

  test('Should point date Change links to trip-date for a same-day trip', () => {
    const viewModel = buildCheckAnswersViewModel(
      fakeRequest({ tripSameDate: true })
    )
    const rows = rowsFor(viewModel, 'Trips details')

    expect(rowChangeHref(rows, 'Departure date')).toBe(
      '/trip-date?return=/check-answers'
    )
    expect(rowChangeHref(rows, 'Return date')).toBe(
      '/trip-date?return=/check-answers'
    )
  })

  test('Should resolve the statistical sub area for the "other, typed" branch', () => {
    const viewModel = buildCheckAnswersViewModel(
      fakeRequest({
        statAreaBranch: 'other',
        selectedAlternativeAreaOption: 'other',
        alternativeStatisticalArea: '46E45'
      })
    )
    const rows = rowsFor(viewModel, 'Trips details')

    expect(rowValue(rows, 'Statistical sub area')).toBe('46E45')
    expect(rowChangeHref(rows, 'Statistical sub area')).toBe(
      '/statistical-area-other?return=/check-answers'
    )
  })

  test('Should resolve the statistical sub area for the "other, listed" branch', () => {
    const viewModel = buildCheckAnswersViewModel(
      fakeRequest({
        statAreaBranch: 'other',
        selectedAlternativeAreaOption: '30f05'
      })
    )
    const rows = rowsFor(viewModel, 'Trips details')

    expect(rowValue(rows, 'Statistical sub area')).toBe('30F05')
  })

  test('Should render pots hauled/left-in-water and the mock mesh size when pots is selected', () => {
    const viewModel = buildCheckAnswersViewModel(
      fakeRequest({
        selectedGearIds: ['pots'],
        potsDetails: { potsHauled: 7, potsInWater: 5 }
      })
    )
    const rows = rowsFor(viewModel, 'Gear used')

    expect(rowValue(rows, 'Gear type')).toBe('Pots')
    expect(rowValue(rows, 'Total pots or traps hauled')).toBe('7')
    expect(rowValue(rows, 'Total pots or traps left in water')).toBe('5')
    expect(rowValue(rows, 'Mesh size')).toBe('50 mm')
  })

  test('Should use the gear hint as the mesh size for non-pots gear and omit pots rows', () => {
    const viewModel = buildCheckAnswersViewModel(
      fakeRequest({ selectedGearIds: ['bottom-otter-trawl'] })
    )
    const rows = rowsFor(viewModel, 'Gear used')

    expect(rowValue(rows, 'Mesh size')).toBe('80mm mesh')
    expect(
      rows.find((row) => row.key.text === 'Total pots or traps hauled')
    ).toBeUndefined()
  })

  test('Should omit the Mesh size row when the selected gear has no mesh data', () => {
    const viewModel = buildCheckAnswersViewModel(
      fakeRequest({ selectedGearIds: ['dredge'] })
    )
    const rows = rowsFor(viewModel, 'Gear used')

    expect(rows.find((row) => row.key.text === 'Mesh size')).toBeUndefined()
  })

  test('Should join multiple selected gear types', () => {
    const viewModel = buildCheckAnswersViewModel(
      fakeRequest({ selectedGearIds: ['dredge', 'traps', 'pots'] })
    )
    const rows = rowsFor(viewModel, 'Gear used')

    expect(rowValue(rows, 'Gear type')).toBe('Dredge, Traps and Pots')
  })

  test('Should omit the Species caught section when cod was not selected', () => {
    const viewModel = buildCheckAnswersViewModel(
      fakeRequest({ selectedSpeciesIds: ['had'] })
    )

    expect(
      viewModel.sections.find((section) => section.heading === 'Species caught')
    ).toBeUndefined()
  })

  test('Should only show the optional weight rows the journey marked visible', () => {
    const viewModel = buildCheckAnswersViewModel(
      fakeRequest({
        selectedSpeciesIds: ['cod'],
        codWeights: { weightAboveMinimum: 12 },
        weightFieldsVisible: { belowMinimum: false, legallyDiscarded: false }
      })
    )
    const rows = rowsFor(viewModel, 'Species caught')

    expect(rowValue(rows, 'Species')).toBe('Atlantic cod')
    expect(rowValue(rows, 'Weight above minimum size retained')).toBe('12 kg')
    expect(
      rows.find((row) => row.key.text === 'Weight below minimum size retained')
    ).toBeUndefined()
    expect(
      rows.find((row) => row.key.text === 'Weight legally discard')
    ).toBeUndefined()
  })

  test('Should show all weight rows when the journey marked them visible', () => {
    const viewModel = buildCheckAnswersViewModel(
      fakeRequest({
        selectedSpeciesIds: ['cod'],
        codWeights: {
          weightAboveMinimum: 15,
          weightBelowMinimum: 10,
          weightDiscarded: 5
        },
        weightFieldsVisible: { belowMinimum: true, legallyDiscarded: true }
      })
    )
    const rows = rowsFor(viewModel, 'Species caught')

    expect(rowValue(rows, 'Weight below minimum size retained')).toBe('10 kg')
    expect(rowValue(rows, 'Weight legally discard')).toBe('5 kg')
  })

  test('Should show only the Not landed row for the only reachable real answer (No)', () => {
    const viewModel = buildCheckAnswersViewModel(
      fakeRequest({ catchNotLanded: false })
    )
    const rows = rowsFor(viewModel, 'Species not landed')

    expect(rowValue(rows, 'Not landed')).toBe('No')
    expect(rows).toHaveLength(1)
  })

  test('Should show the mock Species/Weight rows if catchNotLanded were ever true', () => {
    const viewModel = buildCheckAnswersViewModel(
      fakeRequest({ catchNotLanded: true })
    )
    const rows = rowsFor(viewModel, 'Species not landed')

    expect(rowValue(rows, 'Not landed')).toBe('Yes')
    expect(rowValue(rows, 'Species')).toBe('Atlantic cod (COD)')
    expect(
      rowValue(
        rows,
        'Weight above minimum size kept onboard or in keep pots (kg)'
      )
    ).toBe('5')
  })

  test('Should never expose undefined, null or raw internal ids as a visible value', () => {
    const viewModel = buildCheckAnswersViewModel(
      fakeRequest({
        selectedGearIds: ['pots'],
        selectedSpeciesIds: ['cod'],
        codWeights: { weightAboveMinimum: 10 }
      })
    )

    for (const section of viewModel.sections) {
      for (const row of section.rows) {
        expect(row.value.text).not.toMatch(/undefined|null/)
      }
    }
  })

  test('Should give every Change link a unique accessible name within a section', () => {
    const viewModel = buildCheckAnswersViewModel(fakeRequest(undefined))

    for (const section of viewModel.sections) {
      const names = section.rows.map(
        (row) => row.actions.items[0].visuallyHiddenText
      )
      expect(new Set(names).size).toBe(names.length)
    }
  })

  test('Should use the provided buildChangeHref override for every row', () => {
    const viewModel = buildCheckAnswersViewModel(fakeRequest(undefined), {
      buildChangeHref: () => '/not-implemented?return=/records'
    })

    for (const section of viewModel.sections) {
      for (const row of section.rows) {
        expect(row.actions.items[0].href).toBe(
          '/not-implemented?return=/records'
        )
      }
    }
  })

  test('Should omit the Vessel row Change action when hideVesselChange is set', () => {
    const viewModel = buildCheckAnswersViewModel(fakeRequest(undefined), {
      hideVesselChange: true
    })
    const tripsRows = rowsFor(viewModel, 'Trips details')
    const vesselRow = tripsRows.find((row) => row.key.text === 'Vessel')

    expect(vesselRow.actions.items).toHaveLength(0)
    expect(
      tripsRows.find((row) => row.key.text === 'Departure date').actions.items
    ).toHaveLength(1)
  })
})
