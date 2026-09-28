import Joi from 'joi'

import {
  getJourneyState,
  resolveNextPath,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

const pageTitle = 'Did your trip start and finish today?'

function viewContext(request, overrides = {}) {
  const journeyState = getJourneyState(request)

  return {
    pageTitle,
    heading: pageTitle,
    caption: 'New catch record',
    backLink: {
      href: '/select-vessel',
      text: 'Back'
    },
    selectedValue: journeyState.tripSameDate,
    ...overrides
  }
}

export const tripDateController = {
  handler(request, h) {
    return h.view('trip-date/index', viewContext(request))
  }
}

export const tripDateSubmitController = {
  options: {
    validate: {
      payload: Joi.object({
        tripSameDate: Joi.string().valid('yes', 'no').required()
      }),
      failAction(request, h) {
        const errorText = 'Select yes if your trip started and finished today'

        return h
          .view(
            'trip-date/index',
            viewContext(request, {
              errorSummary: {
                titleText: 'There is a problem',
                errorList: [{ text: errorText, href: '#tripSameDate' }]
              },
              fieldErrors: { tripSameDate: errorText }
            })
          )
          .code(statusCodes.ok)
          .takeover()
      }
    }
  },
  handler(request, h) {
    const { tripSameDate } = request.payload

    setJourneyState(request, { tripSameDate: tripSameDate === 'yes' })

    return h
      .redirect(
        resolveNextPath(
          request,
          tripSameDate === 'yes' ? '/departure-port' : '/trip-departure-date'
        )
      )
      .code(303)
  }
}
