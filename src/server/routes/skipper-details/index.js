import Joi from 'joi'
import {
  getJourneyState,
  accountVesselPath,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import { liveCatchRecords } from '#/server/common/helpers/journey/catch-record-service.js'
import {
  requireSkipperVessel,
  savePendingSkipper
} from '#/server/common/helpers/journey/vessel-skippers.js'

const emailMaxLength = 254
const schema = Joi.object({
  firstName: Joi.string().trim().max(100).required(),
  lastName: Joi.string().trim().max(100).required(),
  email: Joi.string().trim().email().max(emailMaxLength).allow('').optional(),
  phoneNumber: Joi.string().trim().max(30).allow('').optional()
}).custom((value, helpers) => {
  if (!liveCatchRecords() && !value.email) return helpers.error('any.invalid')
  if (
    liveCatchRecords() &&
    `${value.firstName} ${value.lastName}`.length > 100
  ) {
    return helpers.error('any.invalid')
  }
  return value
})
const viewContext = (request, overrides = {}) => ({
  pageTitle: 'Enter skipper details',
  heading: 'Enter skipper details',
  backLink: { href: accountVesselPath(request, '/add-skipper'), text: 'Back' },
  values: liveCatchRecords()
    ? getJourneyState(request).pendingSkipperVesselId ===
      getJourneyState(request).selectedVesselId
      ? getJourneyState(request).pendingSkipper || {}
      : {}
    : getJourneyState(request).skipper || {},
  liveSkippers: liveCatchRecords(),
  ...overrides
})
export const skipperDetailsController = {
  handler(request, h) {
    if (liveCatchRecords()) requireSkipperVessel(request)
    return h.view('skipper-details/index', viewContext(request))
  }
}
export const skipperDetailsSubmitController = {
  options: {
    validate: {
      payload: schema,
      failAction(request, h) {
        if (liveCatchRecords()) requireSkipperVessel(request)
        const errors = {}
        const payload = request.payload || {}
        const value = (key) =>
          typeof payload[key] === 'string' ? payload[key].trim() : ''
        if (!value('firstName')) {
          errors.firstName = 'Enter the skipper’s first name'
        } else if (value('firstName').length > 100) {
          errors.firstName = 'First name must be 100 characters or fewer'
        }
        if (!value('lastName')) {
          errors.lastName = 'Enter the skipper’s last name'
        } else if (value('lastName').length > 100) {
          errors.lastName = 'Last name must be 100 characters or fewer'
        }
        if (
          liveCatchRecords() &&
          `${value('firstName')} ${value('lastName')}`.length > 100
        ) {
          errors.firstName =
            'The full skipper name must be 100 characters or fewer'
        }
        if (!value('email') && !liveCatchRecords()) {
          errors.email = 'Enter the skipper’s email address'
        } else if (
          payload.email &&
          Joi.string().email().max(emailMaxLength).validate(payload.email).error
        ) {
          errors.email = 'Enter an email address in the correct format'
        }
        if (
          payload.phoneNumber &&
          Joi.string().trim().max(30).validate(payload.phoneNumber).error
        ) {
          errors.phoneNumber = 'Phone number must be 30 characters or fewer'
        }
        if (!Object.keys(errors).length) {
          errors.firstName = 'Check the skipper details and try again'
        }
        return h
          .view(
            'skipper-details/index',
            viewContext(request, {
              values: payload,
              errorSummary: {
                titleText: 'There is a problem',
                errorList: Object.entries(errors).map(([field, text]) => ({
                  text,
                  href: `#${field}`
                }))
              },
              fieldErrors: errors
            })
          )
          .code(statusCodes.badRequest)
          .takeover()
      }
    }
  },
  handler(request, h) {
    const details = {
      firstName: request.payload.firstName.trim(),
      lastName: request.payload.lastName.trim(),
      email: request.payload.email?.trim() || '',
      ...(request.payload.phoneNumber
        ? { phoneNumber: request.payload.phoneNumber.trim() }
        : {})
    }
    if (liveCatchRecords()) {
      savePendingSkipper(request, details)
    } else {
      setJourneyState(request, { skipper: details })
    }
    return h
      .redirect(accountVesselPath(request, '/skipper-check'))
      .code(statusCodes.seeOther)
  }
}
