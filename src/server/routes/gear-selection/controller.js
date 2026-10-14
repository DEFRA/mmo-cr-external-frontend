import Joi from 'joi'

import {
  getJourneyState,
  gearPath,
  incompleteGearPath,
  catchDetailsForSelectedGears,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import {
  getFavouriteGearIds,
  getFavouriteGearMeasurements,
  getFavouriteGearOptions,
  getGearCatalogue,
  migrateGearJourneyState
} from '#/server/common/helpers/gear/favourite-gear.js'
import {
  isBlankMeasurement,
  validateMeasurement
} from '#/server/common/helpers/gear/measurement-validation.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

const pageTitle = 'What gear did you use?'
const titleText = 'There is a problem'

// Pots keeps its own dedicated potsHauled/potsInWater fields (wired into
// check-answers/records elsewhere) - every other gear type with a catalogue
// `measurements` config gets the same conditionally-revealed-input pattern,
// generalised here instead of hardcoded to a single gear id.
function measurableOptionsOf(gearId, catalogue) {
  if (gearId === 'pots') {
    return []
  }

  return catalogue.find((gear) => gear.id === gearId)?.measurements || []
}

function measurementFieldName(gearId, measurementId) {
  return `${gearId}-${measurementId}`
}

function gearMeasurementItems(gearId, values, catalogue) {
  return measurableOptionsOf(gearId, catalogue).map((measurement) => ({
    id: measurementFieldName(gearId, measurement.id),
    label: measurement.label,
    value: values[measurement.id]
  }))
}

function gearCheckboxItems(
  selectedGearIds,
  favouriteOptions,
  catalogue,
  measurementDetailsByGearId
) {
  const details = measurementDetailsByGearId || {}
  return favouriteOptions.map((option) => ({
    value: option.id,
    text: option.label,
    hint: option.hint,
    checked: selectedGearIds.includes(option.id),
    measurements: gearMeasurementItems(
      option.id,
      details[option.id] || {},
      catalogue
    )
  }))
}

function defaultMeasurementDetails(journeyState) {
  return {
    ...getFavouriteGearMeasurements(journeyState),
    ...journeyState.gearMeasurementDetails
  }
}

function viewContext(request, catalogue, overrides = {}) {
  const journeyState = migrateGearJourneyState(request, catalogue)
  const selectedGearIds = journeyState.selectedGearIds || []
  const favouriteOptions = getFavouriteGearOptions(
    getFavouriteGearIds(journeyState, catalogue),
    catalogue
  )

  return {
    pageTitle,
    heading: pageTitle,
    caption: 'New catch record',
    backLink: {
      href: '/return-port',
      text: 'Back'
    },
    gearCheckboxItems: gearCheckboxItems(
      selectedGearIds,
      favouriteOptions,
      catalogue,
      defaultMeasurementDetails(journeyState)
    ),
    potsDetails: journeyState.potsDetails || {},
    ...overrides
  }
}

function normalizeGearIds(rawValue) {
  if (rawValue === undefined) {
    return []
  }

  return Array.isArray(rawValue) ? rawValue : [rawValue]
}

function renderWithErrors(
  request,
  h,
  catalogue,
  {
    errorSummary,
    fieldErrors,
    selectedGearIds,
    potsDetails,
    measurementDetailsByGearId
  }
) {
  const journeyState = migrateGearJourneyState(request, catalogue)
  const favouriteOptions = getFavouriteGearOptions(
    getFavouriteGearIds(journeyState, catalogue),
    catalogue
  )

  return h
    .view(
      'gear-selection/index',
      viewContext(request, catalogue, {
        errorSummary,
        fieldErrors,
        ...(selectedGearIds && {
          gearCheckboxItems: gearCheckboxItems(
            selectedGearIds,
            favouriteOptions,
            catalogue,
            measurementDetailsByGearId ||
              defaultMeasurementDetails(journeyState)
          )
        }),
        ...(potsDetails && { potsDetails })
      })
    )
    .code(statusCodes.badRequest)
    .takeover()
}

function validateGearMeasurements(gearIds, payload, catalogue) {
  const errorList = []
  const fieldErrors = {}
  const measurementDetailsByGearId = {}

  for (const gearId of gearIds) {
    const measurements = measurableOptionsOf(gearId, catalogue)

    if (!measurements.length) {
      continue
    }

    measurementDetailsByGearId[gearId] = {}

    for (const measurement of measurements) {
      const fieldName = measurementFieldName(gearId, measurement.id)
      const rawValue = payload[fieldName]

      // Unlike Pots (mandatory), these generalised fields are optional -
      // only validate the format when the user has actually entered something.
      if (isBlankMeasurement(rawValue)) {
        continue
      }

      const { value, error } = validateMeasurement(rawValue, measurement)

      if (error) {
        errorList.push({ text: error, href: `#${fieldName}` })
        fieldErrors[fieldName] = error
      } else {
        measurementDetailsByGearId[gearId][measurement.id] = value
      }
    }
  }

  return { errorList, fieldErrors, measurementDetailsByGearId }
}

function rawGearMeasurementDetails(gearIds, payload, catalogue) {
  const details = {}

  for (const gearId of gearIds) {
    const measurements = measurableOptionsOf(gearId, catalogue)

    if (!measurements.length) {
      continue
    }

    details[gearId] = {}

    for (const measurement of measurements) {
      details[gearId][measurement.id] =
        payload[measurementFieldName(gearId, measurement.id)]
    }
  }

  return details
}

function validatePots(payload, catalogue) {
  const errorList = []
  const fieldErrors = {}
  const potsValues = {}
  const measurements = catalogue.find((gear) => gear.id === 'pots').measurements
  for (const [index, field] of ['potsHauled', 'potsInWater'].entries()) {
    const { value, error } = validateMeasurement(
      payload[field],
      measurements[index]
    )
    potsValues[field] = value
    if (error) {
      errorList.push({ text: error, href: `#${field}` })
      fieldErrors[field] = error
    }
  }
  return { errorList, fieldErrors, potsValues }
}

function validateSelectedGearDetails(gearIds, payload, catalogue) {
  const result = validateGearMeasurements(gearIds, payload, catalogue)
  if (!gearIds.includes('pots')) {
    return result
  }
  const pots = validatePots(payload, catalogue)
  result.errorList.unshift(...pots.errorList)
  result.fieldErrors = { ...pots.fieldErrors, ...result.fieldErrors }
  return { ...result, potsValues: pots.potsValues }
}

function saveSelectedGears(request, gearIds, catalogue, currentState, details) {
  setJourneyState(request, {
    selectedGearIds: gearIds,
    gearLabelsById: Object.fromEntries(
      gearIds.map((id) => {
        const gear = catalogue.find((item) => item.id === id)
        return [id, gear.label || gear.name]
      })
    ),
    catchDetailsByGearId: catchDetailsForSelectedGears(request, gearIds),
    potsDetails: details.potsValues,
    gearMeasurementDetails: details.measurementDetailsByGearId,
    favouriteGearIds: getFavouriteGearIds(currentState, catalogue)
  })
}

export const gearSelectionController = {
  async handler(request, h) {
    const vesselLengthMetres =
      getJourneyState(request).selectedVesselLengthOverallMetres
    const catalogue = await getGearCatalogue({ vesselLengthMetres })
    return h.view('gear-selection/index', viewContext(request, catalogue))
  }
}

export const gearSelectionSubmitController = {
  options: {
    validate: {
      payload: Joi.object({
        gearIds: Joi.alternatives()
          .try(Joi.array().items(Joi.string()).min(1), Joi.string())
          .required(),
        potsHauled: Joi.string().allow(''),
        potsInWater: Joi.string().allow('')
      }).unknown(true),
      async failAction(request, h) {
        const catalogue = await getGearCatalogue({
          vesselLengthMetres:
            getJourneyState(request).selectedVesselLengthOverallMetres
        })
        const errorText = 'Select the gear used on this trip'

        return renderWithErrors(request, h, catalogue, {
          errorSummary: {
            titleText,
            errorList: [{ text: errorText, href: '#gearIds' }]
          },
          fieldErrors: { gearIds: errorText },
          selectedGearIds: normalizeGearIds(request.payload.gearIds)
        })
      }
    }
  },
  async handler(request, h) {
    const vesselLengthMetres =
      getJourneyState(request).selectedVesselLengthOverallMetres
    const catalogue = await getGearCatalogue({ vesselLengthMetres })
    const currentState = migrateGearJourneyState(request, catalogue)
    const { gearIds: rawGearIds, potsHauled, potsInWater } = request.payload
    const gearIds = [
      ...new Set(Array.isArray(rawGearIds) ? rawGearIds : [rawGearIds])
    ]
    const validGearIds = new Set(catalogue.map((gear) => gear.id))
    if (!gearIds.length || gearIds.some((id) => !validGearIds.has(id))) {
      const errorText = 'Select the gear you used'
      return renderWithErrors(request, h, catalogue, {
        errorSummary: {
          titleText,
          errorList: [{ text: errorText, href: '#gearIds' }]
        },
        fieldErrors: { gearIds: errorText },
        selectedGearIds: gearIds
      })
    }
    const potsSelected = gearIds.includes('pots')

    const details = validateSelectedGearDetails(
      gearIds,
      request.payload,
      catalogue
    )
    const { errorList, fieldErrors } = details

    if (errorList.length) {
      return renderWithErrors(request, h, catalogue, {
        errorSummary: { titleText, errorList },
        fieldErrors,
        selectedGearIds: gearIds,
        potsDetails: potsSelected ? { potsHauled, potsInWater } : undefined,
        measurementDetailsByGearId: rawGearMeasurementDetails(
          gearIds,
          request.payload,
          catalogue
        )
      })
    }

    saveSelectedGears(request, gearIds, catalogue, currentState, details)

    const nextPath =
      request.query?.return === '/check-answers'
        ? incompleteGearPath(request) || '/check-answers'
        : gearPath(request, '/statistical-area', gearIds[0])
    return h.redirect(nextPath).code(statusCodes.seeOther)
  }
}
