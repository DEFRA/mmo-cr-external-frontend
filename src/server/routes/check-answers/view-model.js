import { getData } from '#/server/common/data/get-data.js'
import {
  getJourneyState,
  getGearJourneyState,
  gearPath
} from '#/server/common/helpers/journey/navigation.js'
import { formatDate } from '#/config/nunjucks/filters/format-date.js'
import { offlineMapSubrectangleCodes } from '#/server/common/data/offline-map-subrectangle-codes.js'

const RETURN_TO_CHECK_ANSWERS = '?return=/check-answers'
const MESH_HINT_PATTERN = /mm mesh/i

function joinWithAnd(items) {
  if (items.length < 2) {
    return items.join('')
  }
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

function resolvePortName(ports, code, fallbackName, portNamesByCode) {
  return (
    portNamesByCode?.[code] ??
    ports.find((port) => port.code === code)?.name ??
    fallbackName
  )
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
      : offlineMapSubrectangleCodes.has(
            journeyState.selectedAlternativeAreaOption
          )
        ? journeyState.selectedAlternativeAreaOption
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
    fallback.departurePort,
    journeyState.portNamesByCode
  )
  const returnPortName = resolvePortName(
    ports,
    journeyState.returnPort,
    fallback.returnPort,
    journeyState.portNamesByCode
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
        value: journeyState.selectedVesselName || getData('selectVessel').name,
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
  buildChangeHref,
  gearCatalogue,
  compactSummary = false
) {
  const selectedGearIds = journeyState.selectedGearIds
  const hasSelection =
    Array.isArray(selectedGearIds) && selectedGearIds.length > 0
  const potsSelected = hasSelection ? selectedGearIds.includes('pots') : true
  const potsDetails = journeyState.potsDetails || {}
  const changeHref = buildChangeHref('/gear-selection')

  const gearLabel = hasSelection
    ? joinWithAnd(
        selectedGearIds
          .map(
            (id) =>
              gearCatalogue.find((option) => option.id === id)?.name ||
              gearCatalogue.find((option) => option.id === id)?.label
          )
          .filter(Boolean)
      )
    : fallback.gear

  const meshHints = hasSelection
    ? selectedGearIds
        .map((id) => gearCatalogue.find((option) => option.id === id)?.hint)
        .filter((hint) => hint && MESH_HINT_PATTERN.test(hint))
    : []
  const meshSize = resolveMeshSize(meshHints, potsSelected, meshSizeDefault)

  const rows = [
    { key: 'Gear type', value: gearLabel, changeHref },
    ...(potsSelected
      ? [
          {
            key: 'Total pots or traps hauled',
            value: potsDetails.potsHauled ?? fallback.potsHauled,
            changeHref
          },
          {
            key: 'Total pots or traps left in water',
            value: potsDetails.potsInWater ?? fallback.potsInWater,
            changeHref
          }
        ]
      : []),
    ...(meshSize ? [{ key: 'Mesh size', value: meshSize, changeHref }] : [])
  ]
  for (const gearId of selectedGearIds || []) {
    if (gearId === 'pots') {
      continue
    }
    const measurements =
      gearCatalogue.find((gear) => gear.id === gearId)?.measurements || []
    for (const measurement of measurements) {
      const value =
        journeyState.gearMeasurementDetails?.[gearId]?.[measurement.id]
      if (value !== undefined) {
        rows.push({
          key: compactSummary
            ? compactMeasurementLabel(measurement)
            : measurement.label,
          value,
          changeHref
        })
      }
    }
  }

  return { heading: 'Gear used', rows }
}

function compactMeasurementLabel(measurement) {
  const labels = {
    ME: 'Mesh size (mm)',
    MESH_SIZE: 'Mesh size (mm)',
    GN: 'Gear dimension by number',
    GM: 'Gear dimension by length or width of the gear',
    NL: 'Net length (m)',
    HE: 'Net height (m)',
    NN: 'Number of nets',
    QG: 'Quantity of gear onboard',
    NI: 'Number of lines',
    MT: 'Trawl model',
    numberOfTimesShot: 'Number of times gear was shot on the trip'
  }
  const dimensionLabel = measurement.label?.match(
    /^Gear dimension by (?:number|length or width of the gear)/
  )?.[0]
  return (
    dimensionLabel ||
    labels[measurement.code] ||
    labels[measurement.id] ||
    measurement.label
  )
}

function compactRows(rows) {
  return rows.filter(isCompactRow)
}

function isCompactRow(row) {
  return !/^(Departure date|Return date|Not landed)/.test(row.key.text)
}

function resolveMeshSize(meshHints, potsSelected, meshSizeDefault) {
  if (meshHints.length > 0) {
    return meshHints.join(', ')
  }
  return potsSelected ? meshSizeDefault : null
}

function speciesCaughtSection(
  journeyState,
  fallback,
  buildChangeHref,
  speciesCatalogue
) {
  const hasSession = Array.isArray(journeyState.selectedSpeciesIds)
  const selectedIds = hasSession
    ? journeyState.selectedSpeciesIds
    : [speciesCatalogue.find((species) => species.code === 'COD')?.id].filter(
        Boolean
      )
  const selectedSpecies = speciesCatalogue.filter((species) =>
    selectedIds.includes(species.id)
  )

  if (selectedSpecies.length === 0) {
    return null
  }

  const changeHref = buildChangeHref('/species-selection')
  const hasMultipleSpecies = selectedSpecies.length > 1
  const rows = selectedSpecies.flatMap((species) => {
    const weights = journeyState.speciesWeights?.[species.id] || {}
    const useExampleWeights = !hasSession && species.code === 'COD'
    const codeSuffix = hasMultipleSpecies ? ` (${species.code})` : ''
    return speciesCaughtRows(
      species,
      weights,
      fallback,
      changeHref,
      codeSuffix,
      useExampleWeights
    )
  })

  return { heading: 'Species caught', rows }
}

function speciesCaughtRows(
  species,
  weights,
  fallback,
  changeHref,
  codeSuffix,
  useExampleWeights
) {
  const rows = [
    {
      key: `Species${codeSuffix}`,
      value: species.displayName,
      changeHref
    },
    {
      key: `Weight above minimum size retained${codeSuffix}`,
      value: `${weights.weightAboveMinimum ?? (useExampleWeights ? fallback.weightAboveMinimumRetained : '')} ${fallback.weightUnit}`,
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

function speciesNotLandedSection(
  journeyState,
  fallback,
  buildChangeHref,
  speciesCatalogue
) {
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
  const savedSpecies = journeyState.speciesNotLanded || {}
  const hasSavedSpecies = Object.keys(savedSpecies).length > 0
  const notLandedSpecies = hasSavedSpecies
    ? speciesCatalogue.filter((species) =>
        Object.hasOwn(savedSpecies, species.id)
      )
    : [speciesCatalogue.find((species) => species.code === 'COD')].filter(
        Boolean
      )
  const hasMultipleSpecies = notLandedSpecies.length > 1
  const speciesRows = notLandedSpecies.flatMap((species) => {
    const details = savedSpecies[species.id]
    const codeSuffix = hasMultipleSpecies ? ` (${species.code})` : ''
    return [
      {
        key: `Species${codeSuffix}`,
        value: species.text,
        changeHref
      },
      {
        key: `Weight above minimum size kept onboard or in keep pots (kg)${codeSuffix}`,
        value:
          details?.weightAboveMinimum ??
          fallback.notLandedWeightAboveMinimumKept,
        changeHref
      }
    ]
  })

  rows.push(...speciesRows)

  return { heading: 'Species not landed', rows }
}

// Converts a section's raw { key, value, changeHref, isDate } rows into the
// GOV.UK summary-list row shape, applying date formatting and building the
// uniquely-accessible Change action. A falsy changeHref omits the action
// (e.g. the amendment-mode Vessel row, which the design shows with no Change link).
function toSummaryListRow({ key, value, changeHref, isDate }, context = '') {
  return {
    key: { text: key },
    value: { text: isDate ? formatDate(value, 'd MMMM yyyy') : `${value}` },
    actions: changeHref
      ? {
          items: [
            {
              href: changeHref,
              text: 'Change',
              visuallyHiddenText: `${key.toLowerCase()}${context ? ` for ${context}` : ''}`
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
  const journeyState = options.journeyState || getJourneyState(request)
  const speciesCatalogue = options.speciesCatalogue || []
  const gearCatalogue = options.gearCatalogue || getData('gearSelection')
  const fallback = getData('catchRecordDetails')
  const { potsMeshSize } = getData('checkAnswersDefaults')

  if (journeyState.selectedGearIds?.length) {
    const scopedRequest = {
      ...request,
      yar: { get: () => journeyState }
    }
    const tripSection = tripsDetailsSection(
      {
        ...journeyState,
        selectedVesselName:
          journeyState.selectedVesselName || journeyState.vesselName
      },
      fallback,
      buildChangeHref,
      options.hideVesselChange
    )
    tripSection.rows = tripSection.rows.filter(
      (row) => row.key !== 'Statistical sub area'
    )
    tripSection.heading = 'Trip'
    const gearGroups = journeyState.selectedGearIds.map((gearId) => {
      const gearRequest = { ...scopedRequest, query: { gearId } }
      const answers = getGearJourneyState(gearRequest)
      const gear = gearCatalogue.find((item) => item.id === gearId)
      const label =
        gear?.label ||
        gear?.name ||
        journeyState.gearLabelsById?.[gearId] ||
        gearId
      const heading = label
      const changeHref = (path) =>
        gearPath(gearRequest, buildChangeHref(path), gearId)
      const emptyFallback = {
        ...fallback,
        potsHauled: 'Not entered',
        potsInWater: 'Not entered'
      }
      const summaryCatalogue = gearCatalogue.map((item) =>
        item.measurements?.some((measurement) => measurement.id === 'meshSize')
          ? { ...item, hint: null }
          : item
      )
      const details = gearUsedSection(
        { ...journeyState, selectedGearIds: [gearId] },
        emptyFallback,
        null,
        buildChangeHref,
        summaryCatalogue,
        options.compactSummary
      )
      details.heading = 'Gear details'
      const area = {
        heading: 'Statistical area',
        rows: [
          {
            key: 'Statistical area / sub area',
            value: resolveStatisticalSubArea(answers, {
              statisticalSubArea: 'Not entered'
            }),
            changeHref: changeHref(
              answers.statAreaBranch === 'other'
                ? '/statistical-area-other'
                : '/statistical-area'
            )
          }
        ]
      }
      const caught = {
        heading: 'Species caught',
        rows: [],
        speciesGroups: speciesCatalogue
          .filter((species) => answers.selectedSpeciesIds?.includes(species.id))
          .map((species) => ({
            heading: species.text,
            rows: speciesCaughtRows(
              species,
              answers.speciesWeights?.[species.id] || {},
              fallback,
              changeHref('/species-selection'),
              '',
              false
            ).map((row) =>
              row.key === 'Species' ? { ...row, value: species.text } : row
            )
          }))
      }
      const gearRows = [...details.rows, ...area.rows].map((row) =>
        row.key === 'Gear type' ? { ...row, key: 'Gear' } : row
      )
      return {
        gearId,
        heading,
        rows: [
          ...gearRows.map((row) => toSummaryListRow(row, heading)),
          ...caught.speciesGroups.flatMap((speciesGroup) =>
            speciesGroup.rows.map((row) =>
              toSummaryListRow(row, `${speciesGroup.heading}, ${heading}`)
            )
          )
        ].filter((row) => !options.compactSummary || isCompactRow(row))
      }
    })
    const notLandedRows = [
      {
        key: 'Not landed',
        value:
          typeof journeyState.catchNotLanded === 'boolean'
            ? journeyState.catchNotLanded
              ? 'Yes'
              : 'No'
            : 'Not entered',
        changeHref: buildChangeHref('/catch-not-landed')
      }
    ]
    if (journeyState.catchNotLanded) {
      for (const species of speciesCatalogue.filter((item) =>
        Object.hasOwn(journeyState.speciesNotLanded || {}, item.id)
      )) {
        notLandedRows.push(
          {
            key: 'Species',
            value: species.text,
            changeHref: buildChangeHref('/species-not-landed'),
            context: species.text
          },
          {
            key: 'Weight kept onboard or in keep pots',
            value: `${journeyState.speciesNotLanded[species.id].weightAboveMinimum} kg`,
            changeHref: buildChangeHref('/species-not-landed'),
            context: species.text
          }
        )
      }
    }
    return {
      sections: [
        {
          ...tripSection,
          rows: tripSection.rows
            .map((row) => toSummaryListRow(row))
            .filter((row) => !options.compactSummary || isCompactRow(row))
        }
      ],
      gearGroups,
      trailingSections: [
        {
          heading: 'Species not landed',
          rows: notLandedRows
            .filter(
              (row) => !options.compactSummary || row.key !== 'Not landed'
            )
            .map((row) => toSummaryListRow(row, row.context || 'this trip'))
        }
      ].filter((section) => !options.compactSummary || section.rows.length)
    }
  }

  const sections = [
    tripsDetailsSection(
      journeyState,
      fallback,
      buildChangeHref,
      options.hideVesselChange
    ),
    gearUsedSection(
      journeyState,
      fallback,
      potsMeshSize,
      buildChangeHref,
      gearCatalogue,
      options.compactSummary
    ),
    speciesCaughtSection(
      journeyState,
      fallback,
      buildChangeHref,
      speciesCatalogue
    ),
    speciesNotLandedSection(
      journeyState,
      fallback,
      buildChangeHref,
      speciesCatalogue
    )
  ].filter(Boolean)

  if (options.compactSummary) {
    const trip = sections.find((section) => section.heading === 'Trips details')
    const gear = sections.find((section) => section.heading === 'Gear used')
    const caught = sections.find(
      (section) => section.heading === 'Species caught'
    )
    const notLanded = sections.find(
      (section) => section.heading === 'Species not landed'
    )
    const area = trip.rows.find((row) => row.key === 'Statistical sub area')
    const notLandedRows = notLanded.rows
      .filter((row) => row.key !== 'Not landed')
      .map((row) =>
        row.key.startsWith('Weight above minimum size kept onboard')
          ? {
              ...row,
              key: row.key.replace(
                'Weight above minimum size kept onboard or in keep pots (kg)',
                'Weight kept onboard or in keep pots'
              ),
              value: `${row.value} kg`
            }
          : row
      )
    return {
      sections: [
        {
          heading: 'Trip',
          rows: compactRows(
            trip.rows
              .filter((row) => row !== area)
              .map((row) => toSummaryListRow(row))
          )
        }
      ],
      gearGroups: [
        {
          heading: gear.rows[0].value,
          rows: compactRows(
            [
              ...gear.rows.map((row) =>
                row.key === 'Gear type' ? { ...row, key: 'Gear' } : row
              ),
              { ...area, key: 'Statistical area / sub area' },
              ...(caught?.rows || []).map((row) => {
                const species = speciesCatalogue.find(
                  (item) => item.displayName === row.value
                )
                return species ? { ...row, value: species.text } : row
              })
            ].map((row) => toSummaryListRow(row))
          )
        }
      ],
      trailingSections: notLandedRows.length
        ? [
            {
              heading: 'Species not landed',
              rows: notLandedRows.map((row) => toSummaryListRow(row))
            }
          ]
        : []
    }
  }

  return {
    sections: sections.map((section) => ({
      heading: section.heading,
      rows: section.rows.map((row) => toSummaryListRow(row))
    }))
  }
}
