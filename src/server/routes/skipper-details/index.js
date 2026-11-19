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
  pageTitle: t('skipperDetails.title'),
  heading: t('skipperDetails.title'),
  backLink: {
    href: accountVesselPath(request, '/add-skipper'),
    text: t('header.back')
  },
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
    return t('skipperDetails.error.email.empty')
  }
  const invalid =
    payload.email &&
    Joi.string().email().max(emailMaxLength).validate(payload.email).error
  return invalid ? t('skipperDetails.error.email.format') : undefined
}

function phoneNumberError(payload) {
  const invalid =
    payload.phoneNumber &&
    Joi.string().trim().max(phoneNumberMaxLength).validate(payload.phoneNumber)
      .error
  return invalid ? t('skipperDetails.error.phoneNumber.tooLong') : undefined
}

function skipperErrors(payload) {
  const firstName = trimmedValue(payload, 'firstName')
  const lastName = trimmedValue(payload, 'lastName')
  const fullNameTooLong =
    liveCatchRecords() && `${firstName} ${lastName}`.length > nameMaxLength
  const errors = Object.fromEntries(
    Object.entries({
      firstName: fullNameTooLong
        ? t('skipperDetails.error.fullName.tooLong')
        : nameError(
            firstName,
            t('skipperDetails.error.firstName.empty'),
            t('skipperDetails.error.firstName.tooLong')
          ),
      lastName: nameError(
        lastName,
        t('skipperDetails.error.lastName.empty'),
        t('skipperDetails.error.lastName.tooLong')
      ),
      email: emailError(payload),
      phoneNumber: phoneNumberError(payload)
    }).filter(([, text]) => text)
  )
  if (!Object.keys(errors).length) {
    errors.firstName = t('skipperDetails.error.generic')
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
                titleText: t('common.errorSummary.title'),
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
