import Joi from 'joi'

import {
  getJourneyState,
  resolveNextPath,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import {
  findGearOptionByLabel,
  getFavouriteGearIds,
  getGearCatalogue
} from '#/server/common/helpers/gear/favourite-gear.js'
import { getData } from '#/server/common/data/get-data.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

const pageTitle = 'What gear did you use?'
const { reference } = getData('confirmation')

function viewContext(request, overrides = {}) {
  const favouriteGearIds = getFavouriteGearIds(getJourneyState(request))

  return {
    pageTitle,
    heading: pageTitle,
    caption: reference,
    backLink: {
      href: '/gear-selection',
      text: 'Back'
    },
    gearOptionLabels: getGearCatalogue()
      .filter((option) => !favouriteGearIds.includes(option.id))
      .map((option) => option.label),
    ...overrides
  }
}

function renderWithError(request, h, errorText) {
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

export const addGearController = {
  handler(request, h) {
    return h.view('add-gear/index', viewContext(request))
  }
}

export const addGearSubmitController = {
  options: {
    validate: {
      payload: Joi.object({
        gear: Joi.string().trim().min(1).required()
      }),
      failAction(request, h) {
        return renderWithError(request, h, 'Enter the name of the gear you want to add')
      }
    }
  },
  handler(request, h) {
    const matchedOption = findGearOptionByLabel(request.payload.gear)

    if (!matchedOption) {
      return renderWithError(request, h, 'Select a gear type from the list')
    }

    const journeyState = getJourneyState(request)
    const favouriteGearIds = getFavouriteGearIds(journeyState)

    if (!favouriteGearIds.includes(matchedOption.id)) {
      setJourneyState(request, {
        favouriteGearIds: [...favouriteGearIds, matchedOption.id]
      })
    }

    return h.redirect(resolveNextPath(request, '/gear-selection')).code(303)
  }
}
