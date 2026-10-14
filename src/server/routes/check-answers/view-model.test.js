import { buildCheckAnswersViewModel as buildViewModel } from './view-model.js'
import { getData } from '#/server/common/data/get-data.js'
import {
  SPECIES_IDS,
  SPECIES_ITEMS
} from '#/test-helpers/mock-species-reference-data.js'

const speciesCatalogue = SPECIES_ITEMS.map((species) => ({
  id: species.id,
  code: species.faoCode,
  faoCode: species.faoCode,
  displayName: species.displayName,
  text: `${species.displayName} (${species.faoCode})`
}))

function buildCheckAnswersViewModel(request, options = {}) {
  return buildViewModel(request, { speciesCatalogue, ...options })
}

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
  test('Should show every recorded gear detail with short labels without changing stored answers', () => {
    const state = {
      selectedGearIds: ['beam'],
      gearMeasurementDetails: { beam: { length: 3, mesh: 2, count: 2 } },
      catchDetailsByGearId: {
        beam: {
          statAreaBranch: 'direct',
          selectedStatisticalArea: '38E95',
          selectedSpeciesIds: [SPECIES_IDS.cod],
          speciesWeights: {
            [SPECIES_IDS.cod]: {
              weightAboveMinimum: 12,
              weightBelowMinimum: 12,
              weightDiscarded: 11
            }
          }
        }
      },
      catchNotLanded: true,
      speciesNotLanded: {
        [SPECIES_IDS.cod]: { weightAboveMinimum: 2 }
      }
    }
    const original = structuredClone(state)
    const gearCatalogue = [
      {
        id: 'beam',
        code: 'TBB',
        label: 'Beam trawl',
        measurements: [
          { id: 'length', code: 'GM', label: 'Long dimension description' },
          { id: 'mesh', code: 'ME', label: 'Mesh size' },
          { id: 'count', code: 'GN', label: 'Long count description' }
        ]
      }
    ]
    const model = buildCheckAnswersViewModel(fakeRequest(state), {
      gearCatalogue,
      compactSummary: true
    })
    expect(model.sections[0].rows.map((row) => row.key.text)).toEqual([
      'Vessel',
      'Departure port',
      'Return port'
    ])
    expect(model.gearGroups[0].rows.map((row) => row.key.text)).toEqual([
      'Gear',
      'Gear dimension by length or width of the gear',
      'Mesh size (mm)',
      'Gear dimension by number',
      'Statistical area / sub area',
      'Species',
      'Weight above minimum size retained',
      'Weight below minimum size retained',
      'Weight legally discard'
    ])
    expect(rowValue(model.gearGroups[0].rows, 'Gear dimension by number')).toBe(
      '2'
    )
    expect(
      rowValue(
        model.gearGroups[0].rows,
        'Gear dimension by length or width of the gear'
      )
    ).toBe('3')
    expect(
      rowValue(model.gearGroups[0].rows, 'Weight below minimum size retained')
    ).toBe('12 kg')
    expect(rowValue(model.gearGroups[0].rows, 'Weight legally discard')).toBe(
      '11 kg'
    )
    expect(rowValue(model.gearGroups[0].rows, 'Species')).toBe(
      'Atlantic cod (COD)'
    )
    expect(model.trailingSections[0].rows.map((row) => row.key.text)).toEqual([
      'Species',
      'Weight kept onboard or in keep pots'
    ])
    expect(
      rowValue(
        model.trailingSections[0].rows,
        'Weight kept onboard or in keep pots'
      )
    ).toBe('2 kg')
    const full = buildCheckAnswersViewModel(fakeRequest(state), {
      gearCatalogue
    })
    expect(
      rowValue(full.gearGroups[0].rows, 'Long dimension description')
    ).toBe('3')
    expect(rowValue(full.gearGroups[0].rows, 'Weight legally discard')).toBe(
      '11 kg'
    )
    expect(state).toEqual(original)
  })

  test('Should show all selected gears and shorten dimension labels for each without merging values', () => {
    const measurements = [
      {
        id: 'count',
        label:
          'Gear dimension by number. For example: number of trawls, number of beams, number of dredges, number of pots, number of hooks'
      },
      {
        id: 'length',
        label:
          'Gear dimension by length or width of the gear - in metres: length of beams, trawl perimeter of opening'
      }
    ]
    const model = buildCheckAnswersViewModel(
      fakeRequest({
        selectedGearIds: ['beam', 'dredge'],
        gearMeasurementDetails: {
          beam: { count: 2, length: 3 },
          dredge: { count: 4, length: 5 }
        },
        catchDetailsByGearId: {
          beam: {
            statAreaBranch: 'direct',
            selectedStatisticalArea: '38E95',
            selectedSpeciesIds: [SPECIES_IDS.cod],
            speciesWeights: {
              [SPECIES_IDS.cod]: {
                weightAboveMinimum: 12,
                weightBelowMinimum: 0
              }
            }
          },
          dredge: {
            statAreaBranch: 'direct',
            selectedStatisticalArea: '38E96',
            selectedSpeciesIds: [SPECIES_IDS.cod],
            speciesWeights: { [SPECIES_IDS.cod]: { weightAboveMinimum: 15 } }
          }
        }
      }),
      {
        compactSummary: true,
        gearCatalogue: [
          { id: 'beam', label: 'Beam trawl', measurements },
          { id: 'dredge', label: 'Dredge', measurements }
        ]
      }
    )
    expect(model.gearGroups.map((group) => group.heading)).toEqual([
      'Beam trawl',
      'Dredge'
    ])
    for (const [index, group] of model.gearGroups.entries()) {
      expect(rowValue(group.rows, 'Gear dimension by number')).toBe(
        index === 0 ? '2' : '4'
      )
      expect(
        rowValue(group.rows, 'Gear dimension by length or width of the gear')
      ).toBe(index === 0 ? '3' : '5')
      expect(rowValue(group.rows, 'Statistical area / sub area')).toBe(
        index === 0 ? '38E95' : '38E96'
      )
      expect(rowValue(group.rows, 'Weight above minimum size retained')).toBe(
        index === 0 ? '12 kg' : '15 kg'
      )
      expect(rowChangeHref(group.rows, 'Species')).toContain(
        `gearId=${group.gearId}`
      )
    }
    expect(
      rowValue(model.gearGroups[0].rows, 'Weight below minimum size retained')
    ).toBe('0 kg')
    expect(
      model.gearGroups[1].rows.some(
        (row) => row.key.text === 'Weight below minimum size retained'
      )
    ).toBe(false)
  })

  test('Should omit the unlanded section when no species are kept onboard', () => {
    const model = buildCheckAnswersViewModel(
      fakeRequest({ selectedGearIds: ['pots'], catchNotLanded: false }),
      { compactSummary: true }
    )
    expect(model.trailingSections).toEqual([])
  })

  test('Should use the same compact grouping for legacy preview answers', () => {
    const model = buildCheckAnswersViewModel(
      fakeRequest({ selectedSpeciesIds: [], catchNotLanded: false }),
      { compactSummary: true }
    )
    expect(model.sections[0].heading).toBe('Trip')
    expect(model.gearGroups).toHaveLength(1)
    expect(model.gearGroups[0].rows.map((row) => row.key.text)).not.toContain(
      'Species'
    )
    expect(model.trailingSections).toEqual([])
  })

  test('Should render stored zero weights and gear-specific species headings without merging catches', () => {
    const answers = (weight) => ({
      selectedSpeciesIds: [SPECIES_IDS.cod, SPECIES_IDS.haddock],
      speciesWeights: {
        [SPECIES_IDS.cod]: {
          weightAboveMinimum: weight,
          weightBelowMinimum: 0,
          weightDiscarded: 0
        },
        [SPECIES_IDS.haddock]: { weightAboveMinimum: 5 }
      },
      catchNotLanded: false
    })
    const viewModel = buildCheckAnswersViewModel(
      fakeRequest({
        selectedGearIds: ['pots', 'dredge'],
        catchDetailsByGearId: { pots: answers(15), dredge: answers(30) }
      })
    )
    const pots = viewModel.gearGroups[0].rows
    const dredge = viewModel.gearGroups[1].rows
    expect(
      pots
        .filter((row) => row.key.text === 'Species')
        .map((row) => row.value.text)
    ).toEqual(['Atlantic cod (COD)', 'Haddock (HAD)'])
    expect(rowValue(pots, 'Weight above minimum size retained')).toBe('15 kg')
    expect(rowValue(dredge, 'Weight above minimum size retained')).toBe('30 kg')
    expect(rowValue(pots, 'Weight below minimum size retained')).toBe('0 kg')
    expect(rowValue(pots, 'Weight legally discard')).toBe('0 kg')
  })

  test('Should not manufacture example catch answers for a selected gear', () => {
    const viewModel = buildCheckAnswersViewModel(
      fakeRequest({ selectedGearIds: ['pots'], catchDetailsByGearId: {} })
    )
    const rows = viewModel.gearGroups[0].rows
    expect(rowValue(rows, 'Statistical area / sub area')).toBe('Not entered')
    expect(rows.filter((row) => row.key.text === 'Species')).toEqual([])
    expect(rowValue(viewModel.trailingSections[0].rows, 'Not landed')).toBe(
      'Not entered'
    )
  })

  test('Should render stored multi-gear records without using the current journey or Change links', () => {
    const record = {
      vesselName: 'ACHILLES',
      selectedGearIds: ['pots', 'dredge'],
      catchDetailsByGearId: {
        pots: { statAreaBranch: 'direct', selectedStatisticalArea: '38E95' },
        dredge: {
          statAreaBranch: 'other',
          selectedAlternativeAreaOption: '38E96'
        }
      }
    }
    const viewModel = buildCheckAnswersViewModel(
      fakeRequest({ selectedVesselName: 'Wrong vessel' }),
      {
        journeyState: record,
        buildChangeHref: () => null
      }
    )
    expect(rowValue(viewModel.sections[0].rows, 'Vessel')).toBe('ACHILLES')
    expect(
      rowValue(viewModel.gearGroups[1].rows, 'Statistical area / sub area')
    ).toBe('38E96')
    expect(viewModel.gearGroups[1].rows[0].actions.items).toEqual([])
  })

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

  test('Should display the selected API vessel instead of the placeholder vessel', () => {
    const viewModel = buildCheckAnswersViewModel(
      fakeRequest({ selectedVesselName: 'ACHILLES' })
    )
    expect(rowValue(rowsFor(viewModel, 'Trips details'), 'Vessel')).toBe(
      'ACHILLES'
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

  test('Should resolve the statistical sub area for a map-selected code on the "direct" branch', () => {
    const viewModel = buildCheckAnswersViewModel(
      fakeRequest({
        statAreaBranch: 'direct',
        selectedStatisticalArea: '27D86'
      })
    )
    const rows = rowsFor(viewModel, 'Trips details')

    expect(rowValue(rows, 'Statistical sub area')).toBe('27D86')
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

  test('Should fall back to the illustrative sub area when the "direct" selection does not match a nearby area', () => {
    const fallback = getData('catchRecordDetails')
    const viewModel = buildCheckAnswersViewModel(
      fakeRequest({
        statAreaBranch: 'direct',
        selectedStatisticalArea: 'not-a-real-area'
      })
    )
    const rows = rowsFor(viewModel, 'Trips details')

    expect(rowValue(rows, 'Statistical sub area')).toBe(
      fallback.statisticalSubArea
    )
  })

  test('Should fall back to the illustrative sub area for the "other, typed" branch when nothing was typed', () => {
    const fallback = getData('catchRecordDetails')
    const viewModel = buildCheckAnswersViewModel(
      fakeRequest({
        statAreaBranch: 'other',
        selectedAlternativeAreaOption: 'other'
      })
    )
    const rows = rowsFor(viewModel, 'Trips details')

    expect(rowValue(rows, 'Statistical sub area')).toBe(
      fallback.statisticalSubArea
    )
  })

  test('Should fall back to the illustrative sub area for the "other, listed" branch when nothing matches', () => {
    const fallback = getData('catchRecordDetails')
    const viewModel = buildCheckAnswersViewModel(
      fakeRequest({
        statAreaBranch: 'other',
        selectedAlternativeAreaOption: 'not-a-real-area'
      })
    )
    const rows = rowsFor(viewModel, 'Trips details')

    expect(rowValue(rows, 'Statistical sub area')).toBe(
      fallback.statisticalSubArea
    )
  })

  test('Should render pots measurements without inventing a mesh size', () => {
    const viewModel = buildCheckAnswersViewModel(
      fakeRequest({
        selectedGearIds: ['pots'],
        potsDetails: { potsHauled: 7, potsInWater: 5 }
      })
    )
    const rows = viewModel.gearGroups[0].rows

    expect(rowValue(rows, 'Gear')).toBe('Pots')
    expect(rowValue(rows, 'Total pots or traps hauled')).toBe('7')
    expect(rowValue(rows, 'Total pots or traps left in water')).toBe('5')
    expect(rows.find((row) => row.key.text === 'Mesh size')).toBeUndefined()
  })

  test('Should use the recorded mesh measurement for non-pots gear and omit pots rows', () => {
    const viewModel = buildCheckAnswersViewModel(
      fakeRequest({
        selectedGearIds: ['bottom-otter-trawl'],
        gearMeasurementDetails: { 'bottom-otter-trawl': { meshSize: 90 } }
      })
    )
    const rows = viewModel.gearGroups[0].rows

    expect(rowValue(rows, 'Mesh size (mm)')).toBe('90')
    expect(
      rows.find((row) => row.key.text === 'Total pots or traps hauled')
    ).toBeUndefined()
  })

  test('Should omit the Mesh size row when the selected gear has no mesh data', () => {
    const viewModel = buildCheckAnswersViewModel(
      fakeRequest({ selectedGearIds: ['dredge'] })
    )
    const rows = viewModel.gearGroups[0].rows

    expect(rows.find((row) => row.key.text === 'Mesh size')).toBeUndefined()
  })

  test('Should render separate groups in selected gear order', () => {
    const viewModel = buildCheckAnswersViewModel(
      fakeRequest({ selectedGearIds: ['dredge', 'traps', 'pots'] })
    )
    expect(viewModel.gearGroups.map((group) => group.heading)).toEqual([
      'Dredge',
      'Traps',
      'Pots'
    ])
    expect(
      viewModel.sections[0].rows.some(
        (row) => row.key.text === 'Statistical sub area'
      )
    ).toBe(false)
  })

  test('Should show another selected species when cod was not selected', () => {
    const viewModel = buildCheckAnswersViewModel(
      fakeRequest({ selectedSpeciesIds: [SPECIES_IDS.haddock] })
    )

    expect(rowValue(rowsFor(viewModel, 'Species caught'), 'Species')).toBe(
      'Haddock'
    )
  })

  test('Should only show the optional weight rows the journey marked visible', () => {
    const viewModel = buildCheckAnswersViewModel(
      fakeRequest({
        selectedSpeciesIds: [SPECIES_IDS.cod],
        speciesWeights: { [SPECIES_IDS.cod]: { weightAboveMinimum: 12 } }
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
        selectedSpeciesIds: [SPECIES_IDS.cod],
        speciesWeights: {
          [SPECIES_IDS.cod]: {
            weightAboveMinimum: 15,
            weightBelowMinimum: 10,
            weightDiscarded: 5
          }
        }
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

  test('Should show the real captured species-not-landed weight over the fallback example', () => {
    const viewModel = buildCheckAnswersViewModel(
      fakeRequest({
        catchNotLanded: true,
        speciesNotLanded: {
          [SPECIES_IDS.cod]: { weightAboveMinimum: 8 }
        }
      })
    )
    const rows = rowsFor(viewModel, 'Species not landed')

    expect(rowValue(rows, 'Species')).toBe('Atlantic cod (COD)')
    expect(
      rowValue(
        rows,
        'Weight above minimum size kept onboard or in keep pots (kg)'
      )
    ).toBe('8')
    expect(rowChangeHref(rows, 'Species')).toBe(
      '/species-not-landed?return=/check-answers'
    )
    expect(rowChangeHref(rows, 'Not landed')).toBe(
      '/catch-not-landed?return=/check-answers'
    )
  })

  test('Should never expose undefined, null or raw internal ids as a visible value', () => {
    const viewModel = buildCheckAnswersViewModel(
      fakeRequest({
        selectedGearIds: ['pots'],
        selectedSpeciesIds: [SPECIES_IDS.cod],
        speciesWeights: {
          [SPECIES_IDS.cod]: { weightAboveMinimum: 10 }
        }
      })
    )

    for (const section of viewModel.sections) {
      for (const row of section.rows) {
        expect(row.value.text).not.toMatch(/undefined|null/)
      }
    }
  })

  test('Should include each selected species and its weight rows using GUID-keyed state', () => {
    const viewModel = buildCheckAnswersViewModel(
      fakeRequest({
        selectedSpeciesIds: [SPECIES_IDS.cod, SPECIES_IDS.haddock],
        speciesWeights: {
          [SPECIES_IDS.cod]: { weightAboveMinimum: 12 },
          [SPECIES_IDS.haddock]: { weightAboveMinimum: 8 }
        },
        catchNotLanded: true,
        speciesNotLanded: {
          [SPECIES_IDS.cod]: { weightAboveMinimum: 4 },
          [SPECIES_IDS.haddock]: { weightAboveMinimum: 3 }
        }
      })
    )

    const caughtRows = rowsFor(viewModel, 'Species caught')
    const notLandedRows = rowsFor(viewModel, 'Species not landed')

    expect(rowValue(caughtRows, 'Species (COD)')).toBe('Atlantic cod')
    expect(
      rowValue(caughtRows, 'Weight above minimum size retained (HAD)')
    ).toBe('8 kg')
    expect(rowValue(notLandedRows, 'Species (HAD)')).toBe('Haddock (HAD)')
    expect(
      rowValue(
        notLandedRows,
        'Weight above minimum size kept onboard or in keep pots (kg) (COD)'
      )
    ).toBe('4')
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
