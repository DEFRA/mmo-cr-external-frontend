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
  getGearOptionById
} from '#/server/common/helpers/gear/favourite-gear.js'
import { getData } from '#/server/common/data/get-data.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

const pageTitle = 'What gear did you use?'
const { reference } = getData('confirmation')

// Every measurement field id used across the gear catalogue's `measurements`
// arrays — declared explicitly so Joi only accepts known field names.
const measurementFieldIds = [
  'numberOfTrawlNets',
  'meshSize',
  'numberOfDredges',
  'numberOfTimesShot',
  'rodsAndLines',
  'totalHauled',
  'totalInWater',
  'totalHooksHauled',
  'totalHooksInWater'
]

// Keeps the "return" query param across the page's own add/measurement redirects
// so "Save and continue" still honours it once the measurement step is done.
function addGearPath(request) {
  const candidate = request.query && request.query.return
  return candidate
    ? `/add-gear?return=${encodeURIComponent(candidate)}`
    : '/add-gear'
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
  const favouriteGearIds = getFavouriteGearIds(journeyState)
  const pendingGearId = journeyState.addGearPendingId
  const pendingOption = pendingGearId && getGearOptionById(pendingGearId)

  return {
    pageTitle,
    heading: pendingOption
      ? `Enter the measurements for ${pendingOption.label.toLowerCase()}`
      : pageTitle,
    caption: reference,
    backLink: {
      href: '/gear-selection',
      text: 'Back'
    },
    pendingOption,
    gearOptionLabels: getGearCatalogue()
      .filter((option) => !favouriteGearIds.includes(option.id))
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

function renderMeasurementErrors(request, h, errorList, fieldErrors) {
  return h
    .view(
      'add-gear/index',
      viewContext(request, {
        errorSummary: { titleText: 'There is a problem', errorList },
        fieldErrors
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
        gear: Joi.string().allow(''),
        ...Object.fromEntries(
          measurementFieldIds.map((id) => [id, Joi.string().allow('')])
        )
      }),
      failAction(request, h) {
        return renderSearchError(
          request,
          h,
          'Enter the name of the gear you want to add'
        )
      }
    }
  },
  handler(request, h) {
    const journeyState = getJourneyState(request)
    const pendingGearId = journeyState.addGearPendingId
    const pendingOption = pendingGearId && getGearOptionById(pendingGearId)

    if (pendingOption) {
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
        } else {
          values[measurement.id] = value
        }
      }

      if (errorList.length) {
        return renderMeasurementErrors(request, h, errorList, fieldErrors)
      }

      const favouriteGearIds = getFavouriteGearIds(journeyState)
      const favouriteGearMeasurements =
        getFavouriteGearMeasurements(journeyState)

      setJourneyState(request, {
        favouriteGearIds: favouriteGearIds.includes(pendingOption.id)
          ? favouriteGearIds
          : [...favouriteGearIds, pendingOption.id],
        favouriteGearMeasurements: {
          ...favouriteGearMeasurements,
          [pendingOption.id]: values
        },
        addGearPendingId: undefined
      })

      return h
        .redirect(resolveNextPath(request, '/gear-selection'))
        .code(statusCodes.seeOther)
    }

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

    if (matchedOption.measurements) {
      setJourneyState(request, { addGearPendingId: matchedOption.id })
      return h.redirect(addGearPath(request)).code(statusCodes.seeOther)
    }

    const favouriteGearIds = getFavouriteGearIds(journeyState)

    if (!favouriteGearIds.includes(matchedOption.id)) {
      setJourneyState(request, {
        favouriteGearIds: [...favouriteGearIds, matchedOption.id]
      })
    }

    return h
      .redirect(resolveNextPath(request, '/gear-selection'))
      .code(statusCodes.seeOther)
  }
}
