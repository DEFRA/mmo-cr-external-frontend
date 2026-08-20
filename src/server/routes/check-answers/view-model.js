import { getData } from '#/server/common/data/get-data.js'
import { getJourneyState } from '#/server/common/helpers/journey/navigation.js'
import { formatDate } from '#/config/nunjucks/filters/format-date.js'

const RETURN_TO_CHECK_ANSWERS = '?return=/check-answers'
const MESH_HINT_PATTERN = /mm mesh/i
const SPECIES_CODE_SUFFIX = /\s*\([A-Z]+\)$/

function joinWithAnd(items) {
  if (items.length < 2) {
    return items.join('')
  }
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

function tripsDetailsSection(journeyState, fallback) {
  const ports = getData('ports')
  const isSameDayTrip = journeyState.tripSameDate !== false
  const departurePortName =
    ports.find((port) => port.code === journeyState.departurePort)?.name ??
    fallback.departurePort
  const returnPortName =
    ports.find((port) => port.code === journeyState.returnPort)?.name ??
    fallback.returnPort

  let statisticalSubArea = fallback.statisticalSubArea
  if (journeyState.statAreaBranch === 'direct') {
    statisticalSubArea =
      getData('nearbyStatisticalAreas').find(
        (area) => area.id === journeyState.selectedStatisticalArea
      )?.code ?? fallback.statisticalSubArea
  } else if (journeyState.statAreaBranch === 'other') {
    statisticalSubArea =
      journeyState.selectedAlternativeAreaOption === 'other'
        ? (journeyState.alternativeStatisticalArea ??
          fallback.statisticalSubArea)
        : (getData('statisticalAreas').find(
            (area) => area.id === journeyState.selectedAlternativeAreaOption
          )?.code ?? fallback.statisticalSubArea)
  }

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
        changeHref: `/select-vessel${RETURN_TO_CHECK_ANSWERS}`
      },
      {
        key: 'Departure date',
        value: journeyState.departureDate ?? fallback.departureDate,
        isDate: true,
        changeHref: `${dateChangeHref}${RETURN_TO_CHECK_ANSWERS}`
      },
      {
        key: 'Return date',
        value: journeyState.returnDate ?? fallback.returnDate,
        isDate: true,
        changeHref: `${returnDateChangeHref}${RETURN_TO_CHECK_ANSWERS}`
      },
      {
        key: 'Departure port',
        value: departurePortName,
        changeHref: `/departure-port${RETURN_TO_CHECK_ANSWERS}`
      },
      {
        key: 'Return port',
        value: returnPortName,
        changeHref: `/return-port${RETURN_TO_CHECK_ANSWERS}`
      },
      {
        key: 'Statistical sub area',
        value: statisticalSubArea,
        changeHref: `${statisticalAreaChangeHref}${RETURN_TO_CHECK_ANSWERS}`
      }
    ]
  }
}

function gearUsedSection(journeyState, fallback, meshSizeDefault) {
  const gearOptions = getData('gearSelection')
  const selectedGearIds = journeyState.selectedGearIds
  const hasSelection =
    Array.isArray(selectedGearIds) && selectedGearIds.length > 0
  const potsSelected = hasSelection ? selectedGearIds.includes('pots') : true
  const potsDetails = journeyState.potsDetails || {}
  const changeHref = `/gear-selection${RETURN_TO_CHECK_ANSWERS}`

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

function speciesCaughtSection(journeyState, fallback) {
  const selectedSpeciesIds = journeyState.selectedSpeciesIds
  const hasSession = Array.isArray(selectedSpeciesIds)
  const hasCod = hasSession ? selectedSpeciesIds.includes('cod') : true

  if (!hasCod) {
    return null
  }

  const codWeights = journeyState.codWeights || {}
  const weightFieldsVisible = journeyState.weightFieldsVisible
  const showBelowMinimum = hasSession
    ? Boolean(weightFieldsVisible?.belowMinimum)
    : true
  const showLegallyDiscarded = hasSession
    ? Boolean(weightFieldsVisible?.legallyDiscarded)
    : true
  const speciesName = getData('speciesSelection')
    .find((species) => species.id === 'cod')
    .text.replace(SPECIES_CODE_SUFFIX, '')
  const changeHref = `/species-selection${RETURN_TO_CHECK_ANSWERS}`

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

function speciesNotLandedSection(journeyState, fallback) {
  const hasAnswer = typeof journeyState.catchNotLanded === 'boolean'
  const catchNotLanded = hasAnswer
    ? journeyState.catchNotLanded
    : fallback.catchNotLanded
  const changeHref = `/catch-not-landed${RETURN_TO_CHECK_ANSWERS}`

  const rows = [
    { key: 'Not landed', value: catchNotLanded ? 'Yes' : 'No', changeHref }
  ]

  // The catch-not-landed "Yes" capture flow is out of scope, so these two
  // rows are only reachable via the illustrative fallback example for now.
  if (catchNotLanded) {
    rows.push({
      key: 'Species',
      value: fallback.notLandedSpecies,
      changeHref
    })
    rows.push({
      key: 'Weight above minimum size kept onboard or in keep pots (kg)',
      value: fallback.notLandedWeightAboveMinimumKept,
      changeHref
    })
  }

  return { heading: 'Species not landed', rows }
}

// Converts a section's raw { key, value, changeHref, isDate } rows into the
// GOV.UK summary-list row shape, applying date formatting and building the
// uniquely-accessible Change action.
function toSummaryListRow({ key, value, changeHref, isDate }) {
  return {
    key: { text: key },
    value: { text: isDate ? formatDate(value, 'd MMMM yyyy') : `${value}` },
    actions: {
      items: [
        {
          href: changeHref,
          text: 'Change',
          visuallyHiddenText: key.toLowerCase()
        }
      ]
    }
  }
}

export function buildCheckAnswersViewModel(request) {
  const journeyState = getJourneyState(request)
  const fallback = getData('catchRecordDetails')
  const { potsMeshSize } = getData('checkAnswersDefaults')

  const sections = [
    tripsDetailsSection(journeyState, fallback),
    gearUsedSection(journeyState, fallback, potsMeshSize),
    speciesCaughtSection(journeyState, fallback),
    speciesNotLandedSection(journeyState, fallback)
  ].filter(Boolean)

  return {
    sections: sections.map((section) => ({
      heading: section.heading,
      rows: section.rows.map(toSummaryListRow)
    }))
  }
}
