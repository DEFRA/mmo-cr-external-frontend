import Joi from 'joi'
import {
  getJourneyState,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'

const schema = Joi.object({
  firstName: Joi.string().trim().max(100).required(),
  lastName: Joi.string().trim().max(100).required(),
  email: Joi.string().trim().email().max(254).required()
})
const viewContext = (request, overrides = {}) => ({
  pageTitle: 'Enter skipper details',
  heading: 'Enter skipper details',
  backLink: { href: '/add-skipper', text: 'Back' },
  values: getJourneyState(request).skipper || {},
  ...overrides
})
export const skipperDetailsController = {
  handler: (request, h) => h.view('skipper-details/index', viewContext(request))
}
export const skipperDetailsSubmitController = {
  options: {
    validate: {
      payload: schema,
      failAction(request, h) {
        const errors = {}
        if (!request.payload.firstName?.trim()) {
          errors.firstName = 'Enter the skipper’s first name'
        }
        if (!request.payload.lastName?.trim()) {
          errors.lastName = 'Enter the skipper’s last name'
        }
        if (!request.payload.email?.trim()) {
          errors.email = 'Enter the skipper’s email address'
        } else if (Joi.string().email().validate(request.payload.email).error) {
          errors.email = 'Enter an email address in the correct format'
        }
        const firstError = errors.firstName || errors.lastName || errors.email
        return h
          .view(
            'skipper-details/index',
            viewContext(request, {
              values: request.payload,
              errorSummary: {
                titleText: 'There is a problem',
                errorList: [
                  { text: firstError, href: `#${Object.keys(errors)[0]}` }
                ]
              },
              fieldErrors: errors
            })
          )
          .code(400)
          .takeover()
      }
    }
  },
  handler(request, h) {
    setJourneyState(request, {
      skipper: {
        firstName: request.payload.firstName.trim(),
        lastName: request.payload.lastName.trim(),
        email: request.payload.email.trim()
      }
    })
    return h.redirect('/skipper-check').code(303)
  }
}
