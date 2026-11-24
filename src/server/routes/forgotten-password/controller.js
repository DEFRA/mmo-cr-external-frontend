import { t } from '#/server/common/helpers/i18n/translator.js'

import Joi from 'joi'

import { statusCodes } from '#/server/common/constants/status-codes.js'

const heading = () => t('forgottenPassword.title')
const templatePath = 'forgotten-password/index'
const confirmationEmailKey = 'forgottenPasswordEmail'

function viewContext(overrides = {}) {
  return {
    pageTitle: heading(),
    heading: heading(),
    backLink: { href: '/sign-in', text: t('header.back') },
    ...overrides
  }
}

export const forgottenPasswordController = {
  handler(_request, h) {
    return h.view(templatePath, viewContext())
  }
}

export const forgottenPasswordSubmitController = {
  options: {
    validate: {
      payload: Joi.object({
        email: Joi.string()
          .trim()
          .email({ tlds: { allow: false } })
          .required()
      }),
      failAction(request, h) {
        const email =
          typeof request.payload?.email === 'string'
            ? request.payload.email
            : ''
        const errorText = email.trim()
          ? t('forgottenPassword.error.email.format')
          : t('signIn.error.email.empty')

        return h
          .view(
            templatePath,
            viewContext({
              email,
              fieldErrors: { email: errorText },
              errorSummary: {
                titleText: t('common.errorSummary.title'),
                errorList: [{ text: errorText, href: '#email' }]
              }
            })
          )
          .code(statusCodes.badRequest)
          .takeover()
      }
    }
  },
  handler(request, h) {
    request.yar.flash(confirmationEmailKey, request.payload.email)
    return h
      .redirect('/forgotten-password-confirmation')
      .code(statusCodes.seeOther)
  }
}

export const forgottenPasswordConfirmationController = {
  handler(request, h) {
    const email = request.yar.flash(confirmationEmailKey).at(-1)
    if (!email) {
      return h.redirect('/forgotten-password').code(statusCodes.seeOther)
    }
    return h.view(
      templatePath,
      viewContext({
        pageTitle: t('passwordReset.sent.title'),
        heading: t('passwordReset.sent.heading'),
        backLink: null,
        email,
        sent: true
      })
    )
  }
}
