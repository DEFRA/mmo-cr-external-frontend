import Joi from 'joi'

import {
  getJourneyState,
  resolveNextPath,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import {
  findGearOptionByLabel,
  getFavouriteGearIds,
  getFavouriteGearMeasurements,
  getGearCatalogue,
  getGearOptionById,
  getGearItem
} from '#/server/common/helpers/gear/favourite-gear.js'
import { getData } from '#/server/common/data/get-data.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

const pageTitle = 'What gear did you use?'
const { reference } = getData('confirmation')
const addGearViewName = 'add-gear/index'
const gearSelectionPath = '/gear-selection'

// Keeps the "return" query param across the page's own add/measurement redirects
// so "Save and continue" still honours it once the measurement step is done.
function addGearPath(request) {
  const candidate = request.query?.return
  return candidate
    ? `/add-gear?return=${encodeURIComponent(candidate)}`
    : '/add-gear'
}

function normalizeMeasurementValue(rawValue) {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return { value: null, valid: false }
  }

  const numericValue = Number(rawValue)

  return {
    value: numericValue,
    valid: Number.isInteger(numericValue) && numericValue >= 0
  }
}

function viewContext(request, catalogue, overrides = {}) {
  const journeyState = getJourneyState(request)
  const favouriteGearIds = getFavouriteGearIds(journeyState, catalogue)
  const pendingGearId = journeyState.addGearPendingId
  const pendingOption =
    pendingGearId && getGearOptionById(pendingGearId, catalogue)

  return {
    pageTitle,
    heading: pendingOption
      ? `Enter the measurements for ${pendingOption.label.toLowerCase()}`
      : pageTitle,
    caption: reference,
    backLink: {
      href: gearSelectionPath,
      text: 'Back'
    },
    pendingOption,
    gearOptionLabels: catalogue
      .filter((option) => option.id !== 'pots')
      .filter((option) => !favouriteGearIds.includes(option.id))
      .map((option) => option.label),
    ...overrides
  }
}

function renderSearchError(request, h, catalogue, errorText) {
  return h
    .view(
      addGearViewName,
      viewContext(request, catalogue, {
        errorSummary: {
          titleText: 'There is a problem',
          errorList: [{ text: errorText, href: '#gear' }]
        },
        fieldErrors: { gear: errorText }
      })
    )
    .code(statusCodes.badRequest)
    .takeover()
}

function renderMeasurementErrors(
  request,
  h,
  catalogue,
  errorList,
  fieldErrors
) {
  return h
    .view(
      addGearViewName,
      viewContext(request, catalogue, {
        errorSummary: { titleText: 'There is a problem', errorList },
        fieldErrors
      })
    )
    .code(statusCodes.badRequest)
    .takeover()
}

export const addGearController = {
  async handler(request, h) {
    const catalogue = await getGearCatalogue({
      vesselLengthMetres:
        getJourneyState(request).selectedVesselLengthOverallMetres
    })
    return h.view(addGearViewName, viewContext(request, catalogue))
  }
}

function handlePendingMeasurementSubmission(
  request,
  h,
  journeyState,
  pendingOption,
  catalogue
) {
  const errorList = []
  const fieldErrors = {}
  const values = {}

  for (const measurement of pendingOption.measurements) {
    const { value, valid } = normalizeMeasurementValue(
      request.payload[measurement.id]
    )

    if (!valid) {
      const errorText = `Enter the ${measurement.label.toLowerCase()}`
      errorList.push({ text: errorText, href: `#${measurement.id}` })
      fieldErrors[measurement.id] = errorText
    } else if (valid) {
      values[measurement.id] = value
    }
  }

  if (errorList.length) {
    return renderMeasurementErrors(
      request,
      h,
      catalogue,
      errorList,
      fieldErrors
    )
  }

  const favouriteGearIds = getFavouriteGearIds(journeyState, catalogue)
  const favouriteGearMeasurements = getFavouriteGearMeasurements(journeyState)

  setJourneyState(request, {
    favouriteGearIds: favouriteGearIds.includes(pendingOption.id)
      ? favouriteGearIds
      : [...favouriteGearIds, pendingOption.id],
    favouriteGearMeasurements: {
      ...favouriteGearMeasurements,
      [pendingOption.id]: values
    },
    addGearPendingId: null
  })

  return h
    .redirect(resolveNextPath(request, gearSelectionPath))
    .code(statusCodes.seeOther)
}

async function handleGearSearchSubmission(request, h, journeyState, catalogue) {
  const gearLabel = (request.payload.gear || '').trim()

  if (!gearLabel) {
    return renderSearchError(
      request,
      h,
      catalogue,
      'Enter the name of the gear you want to add'
    )
  }

  const matchedOption = findGearOptionByLabel(
    gearLabel,
    catalogue.filter((gear) => gear.id !== 'pots')
  )

  if (!matchedOption) {
    return renderSearchError(
      request,
      h,
      catalogue,
      'Select a gear type from the list'
    )
  }

  await getGearItem(matchedOption.id)
  if (matchedOption.measurements?.length) {
    setJourneyState(request, { addGearPendingId: matchedOption.id })
    return h.redirect(addGearPath(request)).code(statusCodes.seeOther)
  }

  const favouriteGearIds = getFavouriteGearIds(journeyState, catalogue)

  if (!favouriteGearIds.includes(matchedOption.id)) {
    setJourneyState(request, {
      favouriteGearIds: [...favouriteGearIds, matchedOption.id]
    })
  }

  return h
    .redirect(resolveNextPath(request, gearSelectionPath))
    .code(statusCodes.seeOther)
}

export const addGearSubmitController = {
  options: {
    validate: {
      payload: Joi.object({
        gear: Joi.string().allow('')
      }).unknown(true),
      async failAction(request, h) {
        const catalogue = await getGearCatalogue()
        return renderSearchError(
          request,
          h,
          catalogue,
          'Enter the name of the gear you want to add'
        )
      }
    }
  },
  async handler(request, h) {
    const catalogue = await getGearCatalogue({
      vesselLengthMetres:
        getJourneyState(request).selectedVesselLengthOverallMetres
    })
    const journeyState = getJourneyState(request)
    const pendingGearId = journeyState.addGearPendingId
    const pendingOption =
      pendingGearId && getGearOptionById(pendingGearId, catalogue)

    if (pendingOption) {
      const allowedFields = new Set(
        pendingOption.measurements.map(({ id }) => id)
      )
      const hasUnknownFields = Object.keys(request.payload || {}).some(
        (key) => key !== 'gear' && !allowedFields.has(key)
      )
      if (hasUnknownFields) {
        return renderMeasurementErrors(request, h, catalogue, [], {})
      }
      return handlePendingMeasurementSubmission(
        request,
        h,
        journeyState,
        pendingOption,
        catalogue
      )
    }
    return handleGearSearchSubmission(request, h, journeyState, catalogue)
  }
}
