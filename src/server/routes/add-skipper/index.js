import Joi from 'joi'
import {
  getJourneyState,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'

const viewContext = (request, overrides = {}) => ({
  pageTitle: 'Do you want to add a skipper for OLGA?',
  heading: 'Do you want to add a skipper for OLGA?',
  backLink: { href: '/account', text: 'Back' },
  checked: getJourneyState(request).wantsToAddSkipper,
  ...overrides
})

export const addSkipperController = {
  handler: (request, h) => h.view('add-skipper/index', viewContext(request))
}

export const addSkipperSubmitController = {
  options: {
    validate: {
      payload: Joi.object({
        wantsToAddSkipper: Joi.string().valid('yes', 'no').required()
      }),
      failAction(request, h) {
        const errorText = 'Select yes if you want to add a skipper'
        return h
          .view(
            'add-skipper/index',
            viewContext(request, {
              errorSummary: {
                titleText: 'There is a problem',
                errorList: [{ text: errorText, href: '#wantsToAddSkipper' }]
              },
              fieldErrors: { wantsToAddSkipper: errorText }
            })
          )
          .code(400)
          .takeover()
      }
    }
  },
  handler(request, h) {
    const { wantsToAddSkipper } = request.payload
    setJourneyState(request, { wantsToAddSkipper })
    return h
      .redirect(wantsToAddSkipper === 'yes' ? '/skipper-details' : '/account')
      .code(303)
  }
}
