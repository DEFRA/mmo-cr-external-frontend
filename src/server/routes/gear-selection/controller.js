import Joi from 'joi'

import {
  getJourneyState,
  resolveNextPath,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import {
  getFavouriteGearIds,
  getFavouriteGearMeasurements,
  getFavouriteGearOptions,
  getGearCatalogue
} from '#/server/common/helpers/gear/favourite-gear.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

const pageTitle = 'What gear did you use?'
const validGearIds = getGearCatalogue().map((option) => option.id)
const catalogueById = new Map(
  getGearCatalogue().map((option) => [option.id, option])
)

// Pots keeps its own dedicated potsHauled/potsInWater fields (wired into
// check-answers/records elsewhere) - every other gear type with a catalogue
// `measurements` config gets the same conditionally-revealed-input pattern,
// generalised here instead of hardcoded to a single gear id.
function measurableOptionsOf(gearId) {
  if (gearId === 'pots') {
    return []
  }

  return catalogueById.get(gearId)?.measurements || []
}

function measurementFieldName(gearId, measurementId) {
  return `${gearId}-${measurementId}`
}

function gearMeasurementItems(gearId, values) {
  return measurableOptionsOf(gearId).map((measurement) => ({
    id: measurementFieldName(gearId, measurement.id),
    label: measurement.label,
    value: values[measurement.id]
  }))
}

function gearCheckboxItems(
  selectedGearIds,
  favouriteOptions,
  measurementDetailsByGearId = {}
) {
  return favouriteOptions.map((option) => ({
    value: option.id,
    text: option.label,
    hint: option.hint,
    checked: selectedGearIds.includes(option.id),
    measurements: gearMeasurementItems(
      option.id,
      measurementDetailsByGearId[option.id] || {}
    )
  }))
}

function defaultMeasurementDetails(journeyState) {
  return {
    ...getFavouriteGearMeasurements(journeyState),
    ...journeyState.gearMeasurementDetails
  }
}

function viewContext(request, overrides = {}) {
  const journeyState = getJourneyState(request)
  const selectedGearIds = journeyState.selectedGearIds || []
  const favouriteOptions = getFavouriteGearOptions(
    getFavouriteGearIds(journeyState)
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
  {
    errorSummary,
    fieldErrors,
    selectedGearIds,
    potsDetails,
    measurementDetailsByGearId
  }
) {
  const journeyState = getJourneyState(request)
  const favouriteOptions = getFavouriteGearOptions(
    getFavouriteGearIds(journeyState)
  )

  return h
    .view(
      'gear-selection/index',
      viewContext(request, {
        errorSummary,
        fieldErrors,
        ...(selectedGearIds && {
          gearCheckboxItems: gearCheckboxItems(
            selectedGearIds,
            favouriteOptions,
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

function normalizeMeasurementValue(rawValue) {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return { value: undefined, valid: false }
  }

  const numericValue = Number(rawValue)

  return {
    value: numericValue,
    valid: Number.isInteger(numericValue) && numericValue >= 0
  }
}

function validateGearMeasurements(gearIds, payload) {
  const errorList = []
  const fieldErrors = {}
  const measurementDetailsByGearId = {}

  for (const gearId of gearIds) {
    const measurements = measurableOptionsOf(gearId)

    if (!measurements.length) {
      continue
    }

    measurementDetailsByGearId[gearId] = {}

    for (const measurement of measurements) {
      const fieldName = measurementFieldName(gearId, measurement.id)
      const rawValue = payload[fieldName]

      // Unlike Pots (mandatory), these generalised fields are optional -
      // only validate the format when the user has actually entered something.
      if (rawValue === undefined || rawValue === null || rawValue === '') {
        continue
      }

      const { value, valid } = normalizeMeasurementValue(rawValue)

      if (!valid) {
        const errorText = `Enter the ${measurement.label.toLowerCase()}`
        errorList.push({ text: errorText, href: `#${fieldName}` })
        fieldErrors[fieldName] = errorText
      } else {
        measurementDetailsByGearId[gearId][measurement.id] = value
      }
    }
  }

  return { errorList, fieldErrors, measurementDetailsByGearId }
}

function rawGearMeasurementDetails(gearIds, payload) {
  const details = {}

  for (const gearId of gearIds) {
    const measurements = measurableOptionsOf(gearId)

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

export const gearSelectionController = {
  handler(request, h) {
    return h.view('gear-selection/index', viewContext(request))
  }
}

export const gearSelectionSubmitController = {
  options: {
    validate: {
      payload: Joi.object({
        gearIds: Joi.alternatives()
          .try(
            Joi.array()
              .items(Joi.string().valid(...validGearIds))
              .min(1),
            Joi.string().valid(...validGearIds)
          )
          .required(),
        potsHauled: Joi.string().allow(''),
        potsInWater: Joi.string().allow('')
      }).unknown(true),
      failAction(request, h) {
        const errorText = 'Select the gear you used'

        return renderWithErrors(request, h, {
          errorSummary: {
            titleText: 'There is a problem',
            errorList: [{ text: errorText, href: '#gearIds' }]
          },
          fieldErrors: { gearIds: errorText },
          selectedGearIds: normalizeGearIds(request.payload.gearIds)
        })
      }
    }
  },
  handler(request, h) {
    const { gearIds: rawGearIds, potsHauled, potsInWater } = request.payload
    const gearIds = Array.isArray(rawGearIds) ? rawGearIds : [rawGearIds]
    const potsSelected = gearIds.includes('pots')

    const errorList = []
    const fieldErrors = {}
    let potsValues

    if (potsSelected) {
      const hauled = normalizeMeasurementValue(potsHauled)
      const inWater = normalizeMeasurementValue(potsInWater)

      if (!hauled.valid) {
        const errorText = 'Enter the total pots or traps hauled'
        errorList.push({ text: errorText, href: '#potsHauled' })
        fieldErrors.potsHauled = errorText
      }

      if (!inWater.valid) {
        const errorText = 'Enter the total pots or traps left in water'
        errorList.push({ text: errorText, href: '#potsInWater' })
        fieldErrors.potsInWater = errorText
      }

      potsValues = { potsHauled: hauled.value, potsInWater: inWater.value }
    }

    const {
      errorList: gearMeasurementErrors,
      fieldErrors: gearMeasurementFieldErrors,
      measurementDetailsByGearId
    } = validateGearMeasurements(gearIds, request.payload)

    errorList.push(...gearMeasurementErrors)
    Object.assign(fieldErrors, gearMeasurementFieldErrors)

    if (errorList.length) {
      return renderWithErrors(request, h, {
        errorSummary: { titleText: 'There is a problem', errorList },
        fieldErrors,
        selectedGearIds: gearIds,
        potsDetails: potsSelected ? { potsHauled, potsInWater } : undefined,
        measurementDetailsByGearId: rawGearMeasurementDetails(
          gearIds,
          request.payload
        )
      })
    }

    setJourneyState(request, {
      selectedGearIds: gearIds,
      potsDetails: potsSelected ? potsValues : undefined,
      gearMeasurementDetails: measurementDetailsByGearId
    })

    return h.redirect(resolveNextPath(request, '/statistical-area')).code(303)
  }
}
