import Joi from 'joi'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import { setJourneyState } from '#/server/common/helpers/journey/navigation.js'

const errorText = 'Select what you want to do with this draft record'
const MAX_AUTOSAVE_PATH_LENGTH = 200

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
      failAction(_request, h) {
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
      .code(statusCodes.seeOther)
  }
}

// BR-SUB-008: periodically persists in-progress field values so a lost connection or
// closed tab doesn't lose work - the client module debounces calls to this every 10s.
export const draftAutosaveController = {
  options: {
    validate: {
      payload: Joi.object({
        path: Joi.string().max(MAX_AUTOSAVE_PATH_LENGTH).required(),
        fields: Joi.object()
          .pattern(
            Joi.string(),
            Joi.alternatives().try(
              Joi.string().allow(''),
              Joi.array().items(Joi.string()).single()
            )
          )
          .required()
      }),
      failAction(_request, h) {
        return h.response().code(statusCodes.badRequest).takeover()
      }
    }
  },
  handler(request, h) {
    const { path, fields } = request.payload

    setJourneyState(request, {
      autosave: { path, fields, savedAt: new Date().toISOString() }
    })

    return h.response().code(statusCodes.noContent)
  }
}
