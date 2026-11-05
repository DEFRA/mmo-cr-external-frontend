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
  pageTitle: 'Check skipper details',
  heading: 'Check skipper details',
  backLink: {
    href: accountVesselPath(request, '/skipper-details'),
    text: 'Back'
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
        const errorText = 'Confirm the skipper details are complete and correct'
        return h
          .view(
            'skipper-check/index',
            context(request, {
              errorSummary: {
                titleText: 'There is a problem',
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
