import Joi from 'joi'

import { statusCodes } from '#/server/common/constants/status-codes.js'
import { buildCheckAnswersViewModel } from './view-model.js'

const pageTitle = 'Check your catch record'

function viewContext(request, overrides = {}) {
  const { sections } = buildCheckAnswersViewModel(request)

  return {
    pageTitle,
    heading: pageTitle,
    caption: 'New catch record',
    backLink: {
      href: '/catch-not-landed',
      text: 'Back'
    },
    sections,
    ...overrides
  }
}

export const checkAnswersController = {
  handler(request, h) {
    return h.view('check-answers/index', viewContext(request))
  }
}

export const checkAnswersSubmitController = {
  options: {
    validate: {
      payload: Joi.object({
        confirmAccurate: Joi.string().valid('true').required()
      }),
      failAction(request, h) {
        const errorText =
          'Select I confirm the information is complete and accurate'

        return h
          .view(
            'check-answers/index',
            viewContext(request, {
              errorSummary: {
                titleText: 'There is a problem',
                errorList: [{ text: errorText, href: '#confirmAccurate' }]
              },
              fieldErrors: { confirmAccurate: errorText }
            })
          )
          .code(statusCodes.badRequest)
          .takeover()
      }
    }
  },
  handler(_request, h) {
    return h.redirect('/confirmation').code(303)
  }
}
