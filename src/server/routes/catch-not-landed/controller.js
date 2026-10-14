import Joi from 'joi'

import {
  backForCatchNotLanded,
  getJourneyState,
  incompleteGearPath,
  resolveNextPath,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

const pageTitle = 'Is there any catch you won\u2019t be landing straight away?'

function viewContext(request, overrides = {}) {
  return {
    pageTitle,
    heading: pageTitle,
    catchNotLanded: getJourneyState(request).catchNotLanded,
    caption: 'New catch record',
    backLink: {
      href: backForCatchNotLanded(request),
      text: 'Back'
    },
    ...overrides
  }
}

export const catchNotLandedController = {
  handler(request, h) {
    return h.view('catch-not-landed/index', viewContext(request))
  }
}

export const catchNotLandedSubmitController = {
  options: {
    validate: {
      payload: Joi.object({
        catchNotLanded: Joi.string().valid('yes', 'no').required()
      }),
      failAction(request, h) {
        const errorText =
          'Select yes if any catch will not be landed straight away'

        return h
          .view(
            'catch-not-landed/index',
            viewContext(request, {
              errorSummary: {
                titleText: 'There is a problem',
                errorList: [{ text: errorText, href: '#catchNotLanded' }]
              },
              fieldErrors: { catchNotLanded: errorText }
            })
          )
          .code(statusCodes.badRequest)
          .takeover()
      }
    }
  },
  handler(request, h) {
    const { catchNotLanded } = request.payload

    setJourneyState(request, {
      catchNotLanded: catchNotLanded === 'yes',
      ...(catchNotLanded === 'no' && { speciesNotLanded: {} })
    })

    return h
      .redirect(
        catchNotLanded === 'no'
          ? incompleteGearPath(request) ||
              resolveNextPath(request, '/check-answers')
          : '/species-not-landed' +
              (request.query?.return === '/check-answers'
                ? '?return=/check-answers'
                : '')
      )
      .code(statusCodes.seeOther)
  }
}
