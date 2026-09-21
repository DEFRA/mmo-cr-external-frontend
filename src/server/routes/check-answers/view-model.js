import { getData } from '#/server/common/data/get-data.js'
import { getJourneyState } from '#/server/common/helpers/journey/navigation.js'
import { formatDate } from '#/config/nunjucks/filters/format-date.js'
import { offlineMapSubrectangleCodes } from '#/server/common/data/offline-map-subrectangle-codes.js'

const RETURN_TO_CHECK_ANSWERS = '?return=/check-answers'
const MESH_HINT_PATTERN = /mm mesh/i
const SPECIES_CODE_SUFFIX = /\s*\([A-Z]+\)$/

function joinWithAnd(items) {
  if (items.length < 2) {
    return items.join('')
  }
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

function resolvePortName(ports, code, fallbackName) {
  return ports.find((port) => port.code === code)?.name ?? fallbackName
}

function resolveStatisticalSubArea(journeyState, fallback) {
  if (journeyState.statAreaBranch === 'direct') {
    // Map selections save the real ICES code directly; only legacy sessions need the id lookup.
    return offlineMapSubrectangleCodes.has(journeyState.selectedStatisticalArea)
      ? journeyState.selectedStatisticalArea
      : (getData('nearbyStatisticalAreas').find(
          (area) => area.id === journeyState.selectedStatisticalArea
        )?.code ?? fallback.statisticalSubArea)
  }
  if (journeyState.statAreaBranch === 'other') {
    return journeyState.selectedAlternativeAreaOption === 'other'
      ? (journeyState.alternativeStatisticalArea ?? fallback.statisticalSubArea)
      : (getData('statisticalAreas').find(
          (area) => area.id === journeyState.selectedAlternativeAreaOption
        )?.code ?? fallback.statisticalSubArea)
  }
  return fallback.statisticalSubArea
}

function tripsDetailsSection(
  journeyState,
  fallback,
  buildChangeHref,
  hideVesselChange
) {
  const ports = getData('ports')
  const isSameDayTrip = journeyState.tripSameDate !== false
  const departurePortName = resolvePortName(
    ports,
    journeyState.departurePort,
    fallback.departurePort
  )
  const returnPortName = resolvePortName(
    ports,
    journeyState.returnPort,
    fallback.returnPort
  )
  const statisticalSubArea = resolveStatisticalSubArea(journeyState, fallback)

  const dateChangeHref = isSameDayTrip ? '/trip-date' : '/trip-departure-date'
  const returnDateChangeHref = isSameDayTrip
    ? '/trip-date'
    : '/trip-return-date'
  const statisticalAreaChangeHref =
    journeyState.statAreaBranch === 'other'
      ? '/statistical-area-other'
      : '/statistical-area'

  return {
    heading: 'Trips details',
    rows: [
      {
        key: 'Vessel',
        value: getData('selectVessel').name,
        changeHref: hideVesselChange ? null : buildChangeHref('/select-vessel')
      },
      {
        key: 'Departure date',
        value: journeyState.departureDate ?? fallback.departureDate,
        isDate: true,
        changeHref: buildChangeHref(dateChangeHref)
      },
      {
        key: 'Return date',
        value: journeyState.returnDate ?? fallback.returnDate,
        isDate: true,
        changeHref: buildChangeHref(returnDateChangeHref)
      },
      {
        key: 'Departure port',
        value: departurePortName,
        changeHref: buildChangeHref('/departure-port')
      },
      {
        key: 'Return port',
        value: returnPortName,
        changeHref: buildChangeHref('/return-port')
      },
      {
        key: 'Statistical sub area',
        value: statisticalSubArea,
        changeHref: buildChangeHref(statisticalAreaChangeHref)
      }
    ]
  }
}

function gearUsedSection(
  journeyState,
  fallback,
  meshSizeDefault,
  buildChangeHref
) {
  const gearOptions = getData('gearSelection')
  const selectedGearIds = journeyState.selectedGearIds
  const hasSelection =
    Array.isArray(selectedGearIds) && selectedGearIds.length > 0
  const potsSelected = hasSelection ? selectedGearIds.includes('pots') : true
  const potsDetails = journeyState.potsDetails || {}
  const changeHref = buildChangeHref('/gear-selection')

  const gearLabel = hasSelection
    ? joinWithAnd(
        selectedGearIds
          .map((id) => gearOptions.find((option) => option.id === id)?.label)
          .filter(Boolean)
      )
    : fallback.gear

  const meshHints = hasSelection
    ? selectedGearIds
        .map((id) => gearOptions.find((option) => option.id === id)?.hint)
        .filter((hint) => hint && MESH_HINT_PATTERN.test(hint))
    : []
  const meshSize =
    meshHints.length > 0
      ? meshHints.join(', ')
      : potsSelected
        ? meshSizeDefault
        : null

  const rows = [{ key: 'Gear type', value: gearLabel, changeHref }]

  if (potsSelected) {
    rows.push({
      key: 'Total pots or traps hauled',
      value: potsDetails.potsHauled ?? fallback.potsHauled,
      changeHref
    })
    rows.push({
      key: 'Total pots or traps left in water',
      value: potsDetails.potsInWater ?? fallback.potsInWater,
      changeHref
    })
  }

  if (meshSize) {
    rows.push({ key: 'Mesh size', value: meshSize, changeHref })
  }

  return { heading: 'Gear used', rows }
}

function speciesCaughtSection(journeyState, fallback, buildChangeHref) {
  const selectedSpeciesIds = journeyState.selectedSpeciesIds
  const hasSession = Array.isArray(selectedSpeciesIds)
  const hasCod = hasSession ? selectedSpeciesIds.includes('cod') : true

  if (!hasCod) {
    return null
  }

  const codWeights = journeyState.speciesWeights?.cod || {}
  const showBelowMinimum = hasSession
    ? Boolean(codWeights.weightBelowMinimum)
    : true
  const showLegallyDiscarded = hasSession
    ? Boolean(codWeights.weightDiscarded)
    : true
  const speciesName = getData('speciesSelection')
    .find((species) => species.id === 'cod')
    .text.replace(SPECIES_CODE_SUFFIX, '')
  const changeHref = buildChangeHref('/species-selection')

  const rows = [
    { key: 'Species', value: speciesName, changeHref },
    {
      key: 'Weight above minimum size retained',
      value: `${codWeights.weightAboveMinimum ?? fallback.weightAboveMinimumRetained} ${fallback.weightUnit}`,
      changeHref
    }
  ]

  if (showBelowMinimum) {
    rows.push({
      key: 'Weight below minimum size retained',
      value: `${codWeights.weightBelowMinimum ?? fallback.weightBelowMinimumRetained} ${fallback.weightUnit}`,
      changeHref
    })
  }

  if (showLegallyDiscarded) {
    rows.push({
      key: 'Weight legally discard',
      value: `${codWeights.weightDiscarded ?? fallback.weightLegallyDiscarded} ${fallback.weightUnit}`,
      changeHref
    })
  }

  return { heading: 'Species caught', rows }
}

function speciesNotLandedSection(journeyState, fallback, buildChangeHref) {
  const hasAnswer = typeof journeyState.catchNotLanded === 'boolean'
  const catchNotLanded = hasAnswer
    ? journeyState.catchNotLanded
    : fallback.catchNotLanded
  const notLandedChangeHref = buildChangeHref('/catch-not-landed')

  const rows = [
    {
      key: 'Not landed',
      value: catchNotLanded ? 'Yes' : 'No',
      changeHref: notLandedChangeHref
    }
  ]

  if (!catchNotLanded) {
    return { heading: 'Species not landed', rows }
  }

  const changeHref = buildChangeHref('/species-not-landed')
  const codNotLanded = journeyState.speciesNotLanded?.cod
  const speciesName = codNotLanded
    ? getData('speciesSelection').find((species) => species.id === 'cod').text
    : fallback.notLandedSpecies
  const weightAboveMinimum = codNotLanded
    ? codNotLanded.weightAboveMinimum
    : fallback.notLandedWeightAboveMinimumKept

  rows.push({ key: 'Species', value: speciesName, changeHref })
  rows.push({
    key: 'Weight above minimum size kept onboard or in keep pots (kg)',
    value: weightAboveMinimum,
    changeHref
  })

  return { heading: 'Species not landed', rows }
}

// Converts a section's raw { key, value, changeHref, isDate } rows into the
// GOV.UK summary-list row shape, applying date formatting and building the
// uniquely-accessible Change action. A falsy changeHref omits the action
// (e.g. the amendment-mode Vessel row, which the design shows with no Change link).
function toSummaryListRow({ key, value, changeHref, isDate }) {
  return {
    key: { text: key },
    value: { text: isDate ? formatDate(value, 'd MMMM yyyy') : `${value}` },
    actions: changeHref
      ? {
          items: [
            {
              href: changeHref,
              text: 'Change',
              visuallyHiddenText: key.toLowerCase()
            }
          ]
        }
      : { items: [] }
  }
}

export function buildCheckAnswersViewModel(request, options = {}) {
  const buildChangeHref =
    options.buildChangeHref ??
    ((wizardPath) => `${wizardPath}${RETURN_TO_CHECK_ANSWERS}`)
  const journeyState = getJourneyState(request)
  const fallback = getData('catchRecordDetails')
  const { potsMeshSize } = getData('checkAnswersDefaults')

  const sections = [
    tripsDetailsSection(
      journeyState,
      fallback,
      buildChangeHref,
      options.hideVesselChange
    ),
    gearUsedSection(journeyState, fallback, potsMeshSize, buildChangeHref),
    speciesCaughtSection(journeyState, fallback, buildChangeHref),
    speciesNotLandedSection(journeyState, fallback, buildChangeHref)
  ].filter(Boolean)

  return {
    sections: sections.map((section) => ({
      heading: section.heading,
      rows: section.rows.map(toSummaryListRow)
    }))
  }
}
