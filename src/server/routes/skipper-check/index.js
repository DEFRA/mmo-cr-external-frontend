import Joi from 'joi'
import {
  getJourneyState,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
const context = (request, overrides = {}) => ({
  pageTitle: 'Check skipper details',
  heading: 'Check skipper details',
  backLink: { href: '/skipper-details', text: 'Back' },
  skipper: getJourneyState(request).skipper || {},
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
          .code(400)
          .takeover()
      }
    }
  },
  handler(request, h) {
    setJourneyState(request, { skipperConfirmed: true })
    return h.redirect('/skipper-confirmation').code(303)
  }
}
