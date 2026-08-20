import Joi from 'joi'

import { statusCodes } from '#/server/common/constants/status-codes.js'

const pageTitle = 'Is there any catch you won\u2019t be landing straight away?'

function viewContext(overrides = {}) {
  return {
    pageTitle,
    heading: pageTitle,
    caption: 'New catch record',
    backLink: {
      href: '/species-selection',
      text: 'Back'
    },
    ...overrides
  }
}

export const catchNotLandedController = {
  handler(_request, h) {
    return h.view('catch-not-landed/index', viewContext())
  }
}

export const catchNotLandedSubmitController = {
  options: {
    validate: {
      payload: Joi.object({
        catchNotLanded: Joi.string().valid('yes', 'no').required()
      }),
      failAction(_request, h) {
        const errorText = 'Select yes if any catch will not be landed straight away'

        return h
          .view(
            'catch-not-landed/index',
            viewContext({
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

    return h
      .redirect(
        catchNotLanded === 'no'
          ? '/check-answers'
          : '/not-implemented?return=/catch-not-landed'
      )
      .code(303)
  }
}
