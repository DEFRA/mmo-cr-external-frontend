import { t } from '#/server/common/helpers/i18n/translator.js'

import Joi from 'joi'
import {
  getJourneyState,
  accountVesselPath,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import { liveCatchRecords } from '#/server/common/helpers/journey/catch-record-service.js'
import {
  requirePendingSkipper,
  addPendingVesselSkipper
} from '#/server/common/helpers/journey/vessel-skippers.js'
const context = (request, overrides = {}) => ({
  pageTitle: t('skipperCheck.title'),
  heading: t('skipperCheck.title'),
  backLink: {
    href: accountVesselPath(request, '/skipper-details'),
    text: t('header.back')
  },
  changeSkipperHref: accountVesselPath(request, '/skipper-details'),
  skipper: liveCatchRecords()
    ? requirePendingSkipper(request)
    : getJourneyState(request).skipper || {},
  liveSkippers: liveCatchRecords(),
  ...overrides
})
export const skipperCheckController = {
  handler: (request, h) => h.view('skipper-check/index', context(request))
}
export const skipperCheckSubmitController = {
  options: {
    validate: {
      payload: Joi.object({
        confirmSkipper: Joi.string().valid('true').required()
      }),
      failAction(request, h) {
        const errorText = t('skipperCheck.error')
        return h
          .view(
            'skipper-check/index',
            context(request, {
              errorSummary: {
                titleText: t('common.errorSummary.title'),
                errorList: [{ text: errorText, href: '#confirmSkipper' }]
              },
              fieldErrors: { confirmSkipper: errorText }
            })
          )
          .code(statusCodes.badRequest)
          .takeover()
      }
    }
  },
  async handler(request, h) {
    if (liveCatchRecords()) {
      await addPendingVesselSkipper(request)
    } else {
      setJourneyState(request, { skipperConfirmed: true })
    }
    return h
      .redirect(accountVesselPath(request, '/skipper-confirmation'))
      .code(statusCodes.seeOther)
  }
}
