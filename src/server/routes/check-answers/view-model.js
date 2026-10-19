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
    fallback: getData('catchRecordDetails')
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
    gear?.label || gear?.name || journeyState.gearLabelsById?.[gearId] || gearId
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

export function buildCheckAnswersViewModel(request, options = {}) {
  const context = viewModelContext(request, options)
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
