import Joi from 'joi'
import { statusCodes } from '#/server/common/constants/status-codes.js'

const errorText = 'Select what you want to do with this draft record'

function viewContext(overrides = {}) {
  return {
    pageTitle: 'What do you want to do with your draft record?',
    heading: 'What do you want to do with your draft record?',
    caption: 'New catch record',
    backLink: {
      href: '/records',
      text: 'Back'
    },
    ...overrides
  }
}

export const draftController = {
  handler(_request, h) {
    return h.view('draft/index', viewContext())
  }
}

export const draftSubmitController = {
  options: {
    validate: {
      payload: Joi.object({
        draftAction: Joi.string().valid('complete', 'delete').required()
      }),
      failAction(request, h) {
        return h
          .view(
            'draft/index',
            viewContext({
              errorSummary: {
                titleText: 'There is a problem',
                errorList: [{ text: errorText, href: '#draftAction' }]
              },
              fieldErrors: { draftAction: errorText }
            })
          )
          .code(statusCodes.badRequest)
          .takeover()
      }
    }
  },
  handler(request, h) {
    const { draftAction } = request.payload

    return h
      .redirect(
        draftAction === 'complete'
          ? '/select-vessel'
          : '/not-implemented?return=/draft'
      )
      .code(303)
  }
}
