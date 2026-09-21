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
  getGearCatalogue,
  getGearOptionById
} from '#/server/common/helpers/gear/favourite-gear.js'
import { getData } from '#/server/common/data/get-data.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

const pageTitle = 'What gear did you use?'
const { reference } = getData('confirmation')

function findGearOptionByLabel(label) {
  const normalized = label.trim().toLowerCase()
  return getGearCatalogue().find(
    (option) => option.label.toLowerCase() === normalized
  )
}

// Keeps the "return" query param across the page's own add/cancel redirects
// so "Save and continue" still honours it once the user is done adding gear.
function addGearPath(request) {
  const candidate = request.query && request.query.return
  return candidate
    ? `/add-gear?return=${encodeURIComponent(candidate)}`
    : '/add-gear'
}

function addedGearLabels(journeyState) {
  return getFavouriteGearOptions(getFavouriteGearIds(journeyState)).map(
    (option) => option.label
  )
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

function viewContext(request, overrides = {}) {
  const journeyState = getJourneyState(request)
  const pendingGearId = journeyState.addGearPendingId
  const pendingOption = pendingGearId && getGearOptionById(pendingGearId)

  return {
    pageTitle: pendingOption
      ? `What is the ${pendingOption.measurement.label.toLowerCase()} for ${pendingOption.label}?`
      : pageTitle,
    heading: pendingOption
      ? `What is the ${pendingOption.measurement.label.toLowerCase()} for ${pendingOption.label}?`
      : pageTitle,
    caption: reference,
    backLink: {
      href: '/gear-selection',
      text: 'Back'
    },
    addedGear: addedGearLabels(journeyState),
    pendingOption,
    gearOptionLabels: getGearCatalogue()
      .filter(
        (option) => !getFavouriteGearIds(journeyState).includes(option.id)
      )
      .map((option) => option.label),
    ...overrides
  }
}

function renderSearchError(request, h, errorText) {
  return h
    .view(
      'add-gear/index',
      viewContext(request, {
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

function renderMeasurementError(request, h, errorText) {
  return h
    .view(
      'add-gear/index',
      viewContext(request, {
        errorSummary: {
          titleText: 'There is a problem',
          errorList: [{ text: errorText, href: '#measurementValue' }]
        },
        fieldErrors: { measurementValue: errorText }
      })
    )
    .code(statusCodes.badRequest)
    .takeover()
}

export const addGearController = {
  handler(request, h) {
    return h.view('add-gear/index', viewContext(request))
  }
}

export const addGearSubmitController = {
  options: {
    validate: {
      payload: Joi.object({
        action: Joi.string()
          .valid('add', 'confirm-measurement', 'continue', 'cancel')
          .required(),
        gear: Joi.string().allow(''),
        gearId: Joi.string().allow(''),
        measurementValue: Joi.string().allow('')
      }),
      failAction(request, h) {
        return renderSearchError(request, h, 'Select the gear you used')
      }
    }
  },
  handler(request, h) {
    const { action } = request.payload
    const journeyState = getJourneyState(request)

    if (action === 'cancel') {
      setJourneyState(request, { addGearPendingId: undefined })
      return h.redirect(addGearPath(request)).code(statusCodes.seeOther)
    }

    if (action === 'continue') {
      if (journeyState.addGearPendingId) {
        return h.redirect(addGearPath(request)).code(statusCodes.seeOther)
      }

      return h
        .redirect(resolveNextPath(request, '/gear-selection'))
        .code(statusCodes.seeOther)
    }

    if (action === 'confirm-measurement') {
      const pendingGearId = journeyState.addGearPendingId
      const option = pendingGearId && getGearOptionById(pendingGearId)

      if (!option) {
        return h.redirect(addGearPath(request)).code(statusCodes.seeOther)
      }

      const { value, valid } = normalizeMeasurementValue(
        request.payload.measurementValue
      )

      if (!valid) {
        return renderMeasurementError(
          request,
          h,
          `Enter the ${option.measurement.label.toLowerCase()}`
        )
      }

      const favouriteGearIds = getFavouriteGearIds(journeyState)
      const favouriteGearMeasurements =
        getFavouriteGearMeasurements(journeyState)

      setJourneyState(request, {
        favouriteGearIds: favouriteGearIds.includes(option.id)
          ? favouriteGearIds
          : [...favouriteGearIds, option.id],
        favouriteGearMeasurements: {
          ...favouriteGearMeasurements,
          [option.id]: { [option.measurement.id]: value }
        },
        addGearPendingId: undefined
      })

      return h.redirect(addGearPath(request)).code(statusCodes.seeOther)
    }

    // action === 'add'
    const gearLabel = (request.payload.gear || '').trim()

    if (!gearLabel) {
      return renderSearchError(
        request,
        h,
        'Enter the name of the gear you want to add'
      )
    }

    const matchedOption = findGearOptionByLabel(gearLabel)

    if (!matchedOption) {
      return renderSearchError(request, h, 'Select a gear type from the list')
    }

    if (matchedOption.measurement) {
      setJourneyState(request, { addGearPendingId: matchedOption.id })
      return h.redirect(addGearPath(request)).code(statusCodes.seeOther)
    }

    const favouriteGearIds = getFavouriteGearIds(journeyState)

    if (!favouriteGearIds.includes(matchedOption.id)) {
      setJourneyState(request, {
        favouriteGearIds: [...favouriteGearIds, matchedOption.id]
      })
    }

    return h.redirect(addGearPath(request)).code(statusCodes.seeOther)
  }
}
