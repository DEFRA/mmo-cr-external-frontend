import { getData } from '#/server/common/data/get-data.js'
import { formatDate } from '#/config/nunjucks/filters/format-date.js'
import { offlineMapSubrectangleCodes } from '#/server/common/data/offline-map-subrectangle-codes.js'

export const STATISTICAL_SUB_AREA = 'Statistical sub area'
export const STATISTICAL_AREA_LABEL = 'Statistical area / sub area'
export const SPECIES_CAUGHT = 'Species caught'
export const SPECIES_NOT_LANDED = 'Species not landed'
export const NOT_LANDED = 'Not landed'
export const NOT_ENTERED = 'Not entered'
export const SPECIES_NOT_LANDED_PATH = '/species-not-landed'
const LEGACY_KEPT_WEIGHT =
  'Weight above minimum size kept onboard or in keep pots (kg)'
export const KEPT_WEIGHT = 'Weight kept onboard or in keep pots'
const KILOGRAM_UNIT = 'kg'

export function stripKilogramSuffix(value) {
  if (!value.endsWith(KILOGRAM_UNIT)) {
    return value
  }
  const weight = value.slice(0, value.length - KILOGRAM_UNIT.length)
  const trimmedWeight = weight.trimEnd()
  return weight.length === trimmedWeight.length ? value : trimmedWeight
}

function resolveAreaCode(selected, catalogueName, fallback) {
  if (offlineMapSubrectangleCodes.has(selected)) {
    return selected
  }
  return (
    getData(catalogueName).find((area) => area.id === selected)?.code ??
    fallback
  )
}

export function resolveStatisticalSubArea(state, fallback) {
  if (state.statAreaBranch === 'direct') {
    return resolveAreaCode(
      state.selectedStatisticalArea,
      'nearbyStatisticalAreas',
      fallback.statisticalSubArea
    )
  }
  if (state.statAreaBranch !== 'other') {
    return fallback.statisticalSubArea
  }
  if (state.selectedAlternativeAreaOption === 'other') {
    return state.alternativeStatisticalArea ?? fallback.statisticalSubArea
  }
  return resolveAreaCode(
    state.selectedAlternativeAreaOption,
    'statisticalAreas',
    fallback.statisticalSubArea
  )
}

function resolvePortName(ports, code, fallbackName, portNamesByCode) {
  return (
    portNamesByCode?.[code] ??
    ports.find((port) => port.code === code)?.name ??
    fallbackName
  )
}

export function tripsDetailsSection(
  state,
  fallback,
  buildChangeHref,
  hideVesselChange
) {
  const ports = getData('ports')
  const isSameDayTrip = state.tripSameDate !== false
  const dateChangeHref = isSameDayTrip ? '/trip-date' : '/trip-departure-date'
  const returnDateChangeHref = isSameDayTrip
    ? '/trip-date'
    : '/trip-return-date'
  const statisticalAreaChangeHref =
    state.statAreaBranch === 'other'
      ? '/statistical-area-other'
      : '/statistical-area'
  return {
    heading: 'Trips details',
    rows: [
      {
        key: 'Vessel',
        value: state.selectedVesselName || getData('selectVessel').name,
        changeHref: hideVesselChange ? null : buildChangeHref('/select-vessel')
      },
      {
        key: 'Departure date',
        value: state.departureDate ?? fallback.departureDate,
        isDate: true,
        changeHref: buildChangeHref(dateChangeHref)
      },
      {
        key: 'Return date',
        value: state.returnDate ?? fallback.returnDate,
        isDate: true,
        changeHref: buildChangeHref(returnDateChangeHref)
      },
      {
        key: 'Departure port',
        value: resolvePortName(
          ports,
          state.departurePort,
          fallback.departurePort,
          state.portNamesByCode
        ),
        changeHref: buildChangeHref('/departure-port')
      },
      {
        key: 'Return port',
        value: resolvePortName(
          ports,
          state.returnPort,
          fallback.returnPort,
          state.portNamesByCode
        ),
        changeHref: buildChangeHref('/return-port')
      },
      {
        key: STATISTICAL_SUB_AREA,
        value: resolveStatisticalSubArea(state, fallback),
        changeHref: buildChangeHref(statisticalAreaChangeHref)
      }
    ]
  }
}

export function speciesCaughtRows(
  species,
  weights,
  fallback,
  changeHref,
  codeSuffix,
  useExampleWeights
) {
  const defaultAboveMinimum = useExampleWeights
    ? fallback.weightAboveMinimumRetained
    : ''
  const rows = [
    { key: `Species${codeSuffix}`, value: species.displayName, changeHref },
    {
      key: `Weight above minimum size retained${codeSuffix}`,
      value: `${weights.weightAboveMinimum ?? defaultAboveMinimum} ${fallback.weightUnit}`,
      changeHref
    }
  ]
  if (weights.weightBelowMinimum !== undefined || useExampleWeights) {
    rows.push({
      key: `Weight below minimum size retained${codeSuffix}`,
      value: `${weights.weightBelowMinimum ?? fallback.weightBelowMinimumRetained} ${fallback.weightUnit}`,
      changeHref
    })
  }
  if (weights.weightDiscarded !== undefined || useExampleWeights) {
    rows.push({
      key: `Weight legally discard${codeSuffix}`,
      value: `${weights.weightDiscarded ?? fallback.weightLegallyDiscarded} ${fallback.weightUnit}`,
      changeHref
    })
  }
  return rows
}

export function speciesCaughtSection(
  state,
  fallback,
  buildChangeHref,
  speciesCatalogue
) {
  const hasSession = Array.isArray(state.selectedSpeciesIds)
  const selectedIds = hasSession
    ? state.selectedSpeciesIds
    : [speciesCatalogue.find((species) => species.code === 'COD')?.id].filter(
        Boolean
      )
  const selectedSpecies = speciesCatalogue.filter((species) =>
    selectedIds.includes(species.id)
  )
  if (!selectedSpecies.length) {
    return null
  }
  const changeHref = buildChangeHref('/species-selection')
  return {
    heading: SPECIES_CAUGHT,
    rows: selectedSpecies.flatMap((species) =>
      speciesCaughtRows(
        species,
        state.speciesWeights?.[species.id] || {},
        fallback,
        changeHref,
        selectedSpecies.length > 1 ? ` (${species.code})` : '',
        !hasSession && species.code === 'COD'
      )
    )
  }
}

export function speciesNotLandedSection(
  state,
  fallback,
  buildChangeHref,
  speciesCatalogue
) {
  const catchNotLanded =
    typeof state.catchNotLanded === 'boolean'
      ? state.catchNotLanded
      : fallback.catchNotLanded
  const rows = [
    {
      key: NOT_LANDED,
      value: catchNotLanded ? 'Yes' : 'No',
      changeHref: buildChangeHref('/catch-not-landed')
    }
  ]
  if (!catchNotLanded) {
    return { heading: SPECIES_NOT_LANDED, rows }
  }
  const savedSpecies = state.speciesNotLanded || {}
  const selected = Object.keys(savedSpecies).length
    ? speciesCatalogue.filter((species) =>
        Object.hasOwn(savedSpecies, species.id)
      )
    : [speciesCatalogue.find((species) => species.code === 'COD')].filter(
        Boolean
      )
  const changeHref = buildChangeHref(SPECIES_NOT_LANDED_PATH)
  rows.push(
    ...selected.flatMap((species) => {
      const codeSuffix = selected.length > 1 ? ` (${species.code})` : ''
      return [
        { key: `Species${codeSuffix}`, value: species.text, changeHref },
        {
          key: `${LEGACY_KEPT_WEIGHT}${codeSuffix}`,
          value:
            savedSpecies[species.id]?.weightAboveMinimum ??
            fallback.notLandedWeightAboveMinimumKept,
          changeHref
        }
      ]
    })
  )
  return { heading: SPECIES_NOT_LANDED, rows }
}

export function compactNotLandedRows(rows) {
  return rows
    .filter((row) => row.key !== NOT_LANDED)
    .map((row) =>
      row.key.startsWith('Weight above minimum size kept onboard')
        ? {
            ...row,
            key: row.key.replace(LEGACY_KEPT_WEIGHT, KEPT_WEIGHT),
            value: `${row.value} kg`
          }
        : row
    )
}

export function isCompactRow(row) {
  return !/^(Departure date|Return date|Not landed)/.test(row.key.text)
}

export function toSummaryListRow(
  { key, value, changeHref, isDate },
  context = ''
) {
  const contextSuffix = context ? ` for ${context}` : ''
  return {
    key: { text: key },
    value: { text: isDate ? formatDate(value, 'd MMMM yyyy') : `${value}` },
    actions: {
      items: changeHref
        ? [
            {
              href: changeHref,
              text: 'Change',
              visuallyHiddenText: `${key.toLowerCase()}${contextSuffix}`
            }
          ]
        : []
    }
  }
}
