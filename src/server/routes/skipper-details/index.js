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
const nameMaxLength = 100
const phoneNumberMaxLength = 30
const schema = Joi.object({
  firstName: Joi.string().trim().max(nameMaxLength).required(),
  lastName: Joi.string().trim().max(nameMaxLength).required(),
  email: Joi.string().trim().email().max(emailMaxLength).allow('').optional(),
  phoneNumber: Joi.string()
    .trim()
    .max(phoneNumberMaxLength)
    .allow('')
    .optional()
}).custom((value, helpers) => {
  if (!liveCatchRecords() && !value.email) {
    return helpers.error('any.invalid')
  }
  if (
    liveCatchRecords() &&
    `${value.firstName} ${value.lastName}`.length > nameMaxLength
  ) {
    return helpers.error('any.invalid')
  }
  return value
})
function savedSkipperValues(request) {
  const state = getJourneyState(request)
  if (!liveCatchRecords()) {
    return state.skipper || {}
  }
  return state.pendingSkipperVesselId === state.selectedVesselId
    ? state.pendingSkipper || {}
    : {}
}

const viewContext = (request, overrides = {}) => ({
  pageTitle: 'Enter skipper details',
  heading: 'Enter skipper details',
  backLink: { href: accountVesselPath(request, '/add-skipper'), text: 'Back' },
  values: savedSkipperValues(request),
  liveSkippers: liveCatchRecords(),
  ...overrides
})
export const skipperDetailsController = {
  handler(request, h) {
    if (liveCatchRecords()) {
      requireSkipperVessel(request)
    }
    return h.view('skipper-details/index', viewContext(request))
  }
}
function trimmedValue(payload, key) {
  return typeof payload[key] === 'string' ? payload[key].trim() : ''
}

function nameError(value, missingText, tooLongText) {
  if (!value) {
    return missingText
  }
  return value.length > nameMaxLength ? tooLongText : undefined
}

function emailError(payload) {
  if (!trimmedValue(payload, 'email') && !liveCatchRecords()) {
    return 'Enter the skipper’s email address'
  }
  const invalid =
    payload.email &&
    Joi.string().email().max(emailMaxLength).validate(payload.email).error
  return invalid ? 'Enter an email address in the correct format' : undefined
}

function phoneNumberError(payload) {
  const invalid =
    payload.phoneNumber &&
    Joi.string().trim().max(phoneNumberMaxLength).validate(payload.phoneNumber)
      .error
  return invalid ? 'Phone number must be 30 characters or fewer' : undefined
}

function skipperErrors(payload) {
  const firstName = trimmedValue(payload, 'firstName')
  const lastName = trimmedValue(payload, 'lastName')
  const fullNameTooLong =
    liveCatchRecords() && `${firstName} ${lastName}`.length > nameMaxLength
  const errors = Object.fromEntries(
    Object.entries({
      firstName: fullNameTooLong
        ? 'The full skipper name must be 100 characters or fewer'
        : nameError(
            firstName,
            'Enter the skipper’s first name',
            'First name must be 100 characters or fewer'
          ),
      lastName: nameError(
        lastName,
        'Enter the skipper’s last name',
        'Last name must be 100 characters or fewer'
      ),
      email: emailError(payload),
      phoneNumber: phoneNumberError(payload)
    }).filter(([, text]) => text)
  )
  if (!Object.keys(errors).length) {
    errors.firstName = 'Check the skipper details and try again'
  }
  return errors
}

export const skipperDetailsSubmitController = {
  options: {
    validate: {
      payload: schema,
      failAction(request, h) {
        if (liveCatchRecords()) {
          requireSkipperVessel(request)
        }
        const payload = request.payload || {}
        const errors = skipperErrors(payload)
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
