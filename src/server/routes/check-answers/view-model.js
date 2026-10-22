import { getData } from '#/server/common/data/get-data.js'
import {
  getJourneyState,
  getGearJourneyState,
  gearPath
} from '#/server/common/helpers/journey/navigation.js'
import {
  STATISTICAL_SUB_AREA,
  SPECIES_NOT_LANDED,
  NOT_LANDED,
  NOT_ENTERED,
  SPECIES_NOT_LANDED_PATH,
  KEPT_WEIGHT,
  resolveStatisticalSubArea,
  tripsDetailsSection,
  speciesCaughtSection,
  speciesCaughtRows,
  speciesNotLandedSection,
  compactNotLandedRows,
  isCompactRow,
  toSummaryListRow
} from './summary-sections.js'
import {
  gearUsedSection,
  gearSummaryRows,
  summaryGearCatalogue
} from './gear-summary.js'

const RETURN_TO_CHECK_ANSWERS = '?return=/check-answers'

function viewModelContext(request, options) {
  return {
    ...options,
    request,
    buildChangeHref:
      options.buildChangeHref ??
      ((path) => `${path}${RETURN_TO_CHECK_ANSWERS}`),
    journeyState: options.journeyState || getJourneyState(request),
    speciesCatalogue: options.speciesCatalogue || [],
    gearCatalogue: options.gearCatalogue || getData('gearSelection'),
    fallback: options.fallbackDetails || getData('catchRecordDetails')
  }
}

function summaryRows(rows, compactSummary, context = '') {
  const mapped = rows.map((row) => toSummaryListRow(row, context))
  return compactSummary ? mapped.filter(isCompactRow) : mapped
}

function gearAreaRow(answers, changeHref) {
  return {
    key: 'Statistical area / sub area',
    value: resolveStatisticalSubArea(answers, {
      statisticalSubArea: NOT_ENTERED
    }),
    changeHref: changeHref(
      answers.statAreaBranch === 'other'
        ? '/statistical-area-other'
        : '/statistical-area'
    )
  }
}

function gearCaughtRows(answers, context, changeHref, heading) {
  const { speciesCatalogue, fallback } = context
  return speciesCatalogue
    .filter((species) => answers.selectedSpeciesIds?.includes(species.id))
    .flatMap((species) => {
      const rows = speciesCaughtRows(
        species,
        answers.speciesWeights?.[species.id] || {},
        fallback,
        changeHref('/species-selection'),
        '',
        false
      ).map((row) =>
        row.key === 'Species' ? { ...row, value: species.text } : row
      )
      return summaryRows(
        rows,
        context.compactSummary,
        `${species.text}, ${heading}`
      )
    })
}

function gearGroup(gearId, context) {
  const { request, journeyState, gearCatalogue, buildChangeHref, fallback } =
    context
  const gearRequest = {
    ...request,
    yar: { get: () => journeyState },
    query: { gearId }
  }
  const answers = getGearJourneyState(gearRequest)
  const gear = gearCatalogue.find((item) => item.id === gearId)
  const heading =
    gear?.label ||
    gear?.name ||
    journeyState.gearLabelsById?.[gearId] ||
    journeyState.selectedGearNamesById?.[gearId] ||
    gearId
  const changeHref = (path) =>
    gearPath(gearRequest, buildChangeHref(path), gearId)
  const details = gearUsedSection(
    { ...journeyState, selectedGearIds: [gearId] },
    { ...fallback, potsHauled: NOT_ENTERED, potsInWater: NOT_ENTERED },
    null,
    buildChangeHref,
    summaryGearCatalogue(gearCatalogue),
    context.compactSummary
  )
  return {
    gearId,
    heading,
    rows: [
      ...summaryRows(
        gearSummaryRows([...details.rows, gearAreaRow(answers, changeHref)]),
        context.compactSummary,
        heading
      ),
      ...gearCaughtRows(answers, context, changeHref, heading)
    ]
  }
}

function unlandedAnswer(value) {
  if (typeof value !== 'boolean') {
    return NOT_ENTERED
  }
  return value ? 'Yes' : 'No'
}

function unlandedSpeciesRows(context) {
  const { journeyState, speciesCatalogue, buildChangeHref } = context
  if (!journeyState.catchNotLanded) {
    return []
  }
  const saved = journeyState.speciesNotLanded || {}
  const changeHref = buildChangeHref(SPECIES_NOT_LANDED_PATH)
  return speciesCatalogue
    .filter((species) => Object.hasOwn(saved, species.id))
    .flatMap((species) => [
      {
        key: 'Species',
        value: species.text,
        changeHref,
        context: species.text
      },
      {
        key: KEPT_WEIGHT,
        value: `${saved[species.id].weightAboveMinimum} kg`,
        changeHref,
        context: species.text
      }
    ])
}

function trailingSections(context) {
  const rows = [
    {
      key: NOT_LANDED,
      value: unlandedAnswer(context.journeyState.catchNotLanded),
      changeHref: context.buildChangeHref('/catch-not-landed')
    },
    ...unlandedSpeciesRows(context)
  ]
  const visibleRows = context.compactSummary
    ? rows.filter((row) => row.key !== NOT_LANDED)
    : rows
  if (!visibleRows.length) {
    return []
  }
  return [
    {
      heading: SPECIES_NOT_LANDED,
      rows: visibleRows.map((row) =>
        toSummaryListRow(row, row.context || 'this trip')
      )
    }
  ]
}

function groupedViewModel(context) {
  const { journeyState, fallback, buildChangeHref, hideVesselChange } = context
  const trip = tripsDetailsSection(
    {
      ...journeyState,
      selectedVesselName:
        journeyState.selectedVesselName || journeyState.vesselName
    },
    fallback,
    buildChangeHref,
    hideVesselChange
  )
  return {
    sections: [
      {
        heading: 'Trip',
        rows: summaryRows(
          trip.rows.filter((row) => row.key !== STATISTICAL_SUB_AREA),
          context.compactSummary
        )
      }
    ],
    gearGroups: journeyState.selectedGearIds.map((id) =>
      gearGroup(id, context)
    ),
    trailingSections: trailingSections(context)
  }
}

function legacySections(context) {
  const { journeyState, fallback, buildChangeHref, speciesCatalogue } = context
  const { potsMeshSize } = getData('checkAnswersDefaults')
  return {
    trip: tripsDetailsSection(
      journeyState,
      fallback,
      buildChangeHref,
      context.hideVesselChange
    ),
    gear: gearUsedSection(
      journeyState,
      fallback,
      potsMeshSize,
      buildChangeHref,
      context.gearCatalogue,
      context.compactSummary
    ),
    caught: speciesCaughtSection(
      journeyState,
      fallback,
      buildChangeHref,
      speciesCatalogue
    ),
    notLanded: speciesNotLandedSection(
      journeyState,
      fallback,
      buildChangeHref,
      speciesCatalogue
    )
  }
}

function legacyCaughtRows(caught, speciesCatalogue) {
  return (caught?.rows || []).map((row) => {
    const species = speciesCatalogue.find(
      (item) => item.displayName === row.value
    )
    return species ? { ...row, value: species.text } : row
  })
}

function compactLegacyViewModel(sections, context) {
  const { trip, gear, caught, notLanded } = sections
  const area = trip.rows.find((row) => row.key === STATISTICAL_SUB_AREA)
  const notLandedRows = compactNotLandedRows(notLanded.rows)
  return {
    sections: [
      {
        heading: 'Trip',
        rows: summaryRows(
          trip.rows.filter((row) => row !== area),
          true
        )
      }
    ],
    gearGroups: [
      {
        heading: gear.rows[0].value,
        rows: summaryRows(
          [
            ...gearSummaryRows(gear.rows),
            { ...area, key: 'Statistical area / sub area' },
            ...legacyCaughtRows(caught, context.speciesCatalogue)
          ],
          true
        )
      }
    ],
    trailingSections: notLandedRows.length
      ? [
          {
            heading: SPECIES_NOT_LANDED,
            rows: summaryRows(notLandedRows, false)
          }
        ]
      : []
  }
}

function reviewSpeciesGroups(group, speciesCatalogue) {
  const speciesGroups = []
  for (const row of group.rows) {
    if (row.key.text.startsWith('Species')) {
      speciesGroups.push({
        heading: row.value.text,
        speciesId: speciesCatalogue.find(
          (species) => species.text === row.value.text
        )?.id,
        gearId: group.gearId,
        gearHeading: group.heading,
        rows: []
      })
    } else if (row.key.text.startsWith('Weight') && speciesGroups.length) {
      const label = row.key.text
        .replace(/ \([A-Z]+\)$/, '')
        .replace('Weight legally discard', 'Weight legally discarded')
      const weightField = row.key.text.startsWith('Weight above')
        ? 'weightAboveMinimum'
        : row.key.text.startsWith('Weight below')
          ? 'weightBelowMinimum'
          : 'weightDiscarded'
      const speciesId = speciesGroups.at(-1).speciesId
      speciesGroups.at(-1).rows.push({
        ...row,
        key: { text: `${label} (kg)` },
        value: { text: row.value.text.replace(/\s+kg$/, '') },
        actions: {
          items: row.actions.items.map((item) => ({
            ...item,
            href: speciesId
              ? `${item.href}#${weightField}-${speciesId}`
              : item.href
          }))
        }
      })
    }
  }
  return speciesGroups
}

function reviewBaseModel(context) {
  const fullContext = {
    ...context,
    compactSummary: false,
    hideVesselChange: true
  }
  if (context.journeyState.selectedGearIds?.length) {
    return groupedViewModel(fullContext)
  }
  const { trip, gear, caught, notLanded } = legacySections(fullContext)
  const area = trip.rows.find((row) => row.key === STATISTICAL_SUB_AREA)
  return {
    sections: [
      {
        rows: summaryRows(
          trip.rows.filter((row) => row !== area),
          false
        )
      }
    ],
    gearGroups: [
      {
        heading: gear.rows[0].value,
        rows: summaryRows(
          [
            ...gearSummaryRows(gear.rows),
            { ...area, key: 'Statistical area / sub area' },
            ...legacyCaughtRows(caught, context.speciesCatalogue)
          ],
          false
        )
      }
    ],
    trailingSections: [
      { heading: SPECIES_NOT_LANDED, rows: summaryRows(notLanded.rows, false) }
    ]
  }
}

function reviewViewModel(context) {
  const base = reviewBaseModel(context)
  const labels = [
    ['Vessel', 'Vessel'],
    ['Departure date', 'Date left'],
    ['Departure port', 'Port left from'],
    ['Return date', 'Date returned'],
    ['Return port', 'Port returned to']
  ]
  const tripRows = labels.map(([original, label]) => ({
    ...base.sections[0].rows.find((row) => row.key.text === original),
    key: { text: label }
  }))
  const gearUsed = toSummaryListRow({
    key: 'Gear used',
    value: '',
    changeHref: context.buildChangeHref('/gear-selection')
  })
  gearUsed.value = { items: base.gearGroups.map((group) => group.heading) }
  tripRows.push(gearUsed)
  const speciesGroups = base.gearGroups.flatMap((group) =>
    reviewSpeciesGroups(group, context.speciesCatalogue)
  )

  return {
    sections: [{ heading: '1. Trips details', rows: tripRows }],
    gearGroups: base.gearGroups.map((group) => {
      const area = group.rows.find(
        (row) => row.key.text === 'Statistical area / sub area'
      )
      const species = speciesGroups.filter(
        (item) => item.gearId === group.gearId
      )
      const selectedSpecies = group.rows.find((row) =>
        row.key.text.startsWith('Species')
      )
      return {
        ...group,
        rows: [
          ...(area
            ? [{ ...area, key: { text: 'Area majority catch caught' } }]
            : []),
          ...(selectedSpecies
            ? [
                {
                  ...selectedSpecies,
                  key: { text: 'Species caught' },
                  value: { items: species.map((item) => item.heading) }
                }
              ]
            : []),
          ...group.rows
            .filter(
              (row) =>
                row !== area &&
                row.key.text !== 'Gear' &&
                !row.key.text.startsWith('Species') &&
                !row.key.text.startsWith('Weight')
            )
            .toSorted(
              (first, second) =>
                Number(second.key.text.startsWith('Number of times gear')) -
                Number(first.key.text.startsWith('Number of times gear'))
            )
            .map((row) => {
              const measurement = context.gearCatalogue
                .find((gear) => gear.id === group.gearId)
                ?.measurements?.find((item) => item.label === row.key.text)
              const potsFields = {
                'Total pots or traps hauled': 'potsHauled',
                'Total pots or traps left in water': 'potsInWater'
              }
              const field =
                potsFields[row.key.text] ||
                (measurement ? `${group.gearId}-${measurement.id}` : null)
              return field
                ? {
                    ...row,
                    actions: {
                      items: row.actions.items.map((item) => ({
                        ...item,
                        href: `${item.href}#${field}`
                      }))
                    }
                  }
                : row
            })
        ]
      }
    }),
    speciesGroups,
    trailingSections: base.trailingSections.map((section) => ({
      ...section,
      heading: '4. Species not landed',
      rows: section.rows.map((row) =>
        row.key.text === NOT_LANDED
          ? { ...row, key: { text: 'Catch kept onboard or in keep pots' } }
          : row
      )
    }))
  }
}

function readOnlyViewModel(context) {
  const readOnlyContext = {
    ...context,
    compactSummary: false,
    hideVesselChange: true,
    buildChangeHref: () => null
  }
  if (!context.journeyState.selectedGearIds?.length) {
    const { trip, gear, caught, notLanded } = legacySections(readOnlyContext)
    gear.rows = gear.rows.filter((row) => row.key !== 'Mesh size')
    return {
      sections: [trip, gear, caught, notLanded]
        .filter(Boolean)
        .map((section) => ({
          heading: section.heading,
          rows: summaryRows(section.rows, false)
        }))
    }
  }
  const base = reviewBaseModel(readOnlyContext)
  const multipleGears = base.gearGroups.length > 1
  const areaRows = base.gearGroups.flatMap((group) => {
    const area = group.rows.find(
      (row) => row.key.text === 'Statistical area / sub area'
    )
    return area
      ? [
          {
            ...area,
            key: {
              text: multipleGears
                ? `${STATISTICAL_SUB_AREA} (${group.heading})`
                : STATISTICAL_SUB_AREA
            }
          }
        ]
      : []
  })
  const gearGroups = base.gearGroups.map((group) => ({
    ...group,
    rows: group.rows
      .filter(
        (row) =>
          row.key.text !== 'Statistical area / sub area' &&
          !row.key.text.startsWith('Species') &&
          !row.key.text.startsWith('Weight')
      )
      .map((row) =>
        row.key.text === 'Gear' ? { ...row, key: { text: 'Gear type' } } : row
      )
  }))
  const speciesGroups = base.gearGroups
    .map((group) => ({
      ...group,
      rows: group.rows.filter(
        (row) =>
          row.key.text.startsWith('Species') ||
          row.key.text.startsWith('Weight')
      )
    }))
    .filter((group) => group.rows.length)

  return {
    sections: [
      {
        heading: 'Trips details',
        rows: [...base.sections[0].rows, ...areaRows]
      },
      {
        heading: 'Gear used',
        groups: gearGroups,
        groupIdPrefix: 'gear-summary',
        rows: []
      },
      {
        heading: 'Species caught',
        groups: speciesGroups,
        groupIdPrefix: 'species-summary',
        rows: []
      },
      ...base.trailingSections.map((section) => ({
        ...section,
        rows: section.rows.map((row) =>
          row.key.text === KEPT_WEIGHT
            ? {
                ...row,
                key: {
                  text: 'Weight above minimum size kept onboard or in keep pots (kg)'
                },
                value: { text: row.value.text.replace(/\s+kg$/, '') }
              }
            : row
        )
      }))
    ]
  }
}

export function buildCheckAnswersViewModel(request, options = {}) {
  const context = viewModelContext(request, options)
  if (context.readOnly) {
    return readOnlyViewModel(context)
  }
  if (context.reviewLayout) {
    return reviewViewModel(context)
  }
  if (context.journeyState.selectedGearIds?.length) {
    return groupedViewModel(context)
  }
  const sections = legacySections(context)
  if (context.compactSummary) {
    return compactLegacyViewModel(sections, context)
  }
  return {
    sections: Object.values(sections)
      .filter(Boolean)
      .map((section) => ({
        heading: section.heading,
        rows: summaryRows(section.rows, false)
      }))
  }
}
