import { t } from '#/server/common/helpers/i18n/translator.js'

import Joi from 'joi'

import {
  catchRecordCaption,
  backForCatchNotLanded,
  getJourneyState,
  incompleteGearPath,
  resolveNextPath,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

const pageTitle = () => t('web.catch-not-landed.controller.js.copy.14.1')

function viewContext(request, overrides = {}) {
  return {
    pageTitle: pageTitle(),
    heading: pageTitle(),
    catchNotLanded: getJourneyState(request).catchNotLanded,
    caption: catchRecordCaption(request),
    backLink: {
      href: backForCatchNotLanded(request),
      text: t('header.back')
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
        const errorText = t('web.catch-not-landed.controller.js.copy.44.1')

        return h
          .view(
            'catch-not-landed/index',
            viewContext(request, {
              errorSummary: {
                titleText: t('common.errorSummary.title'),
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

    const returnQuery =
      request.query?.return === '/check-answers' ? '?return=/check-answers' : ''
    const nextPath =
      catchNotLanded === 'no'
        ? incompleteGearPath(request) ||
          resolveNextPath(request, '/check-answers')
        : '/species-not-landed' + returnQuery
    return h.redirect(nextPath).code(statusCodes.seeOther)
  }
}
