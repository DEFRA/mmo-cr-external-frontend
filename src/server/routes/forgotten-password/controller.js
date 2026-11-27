import { t } from '#/server/common/helpers/i18n/translator.js'

import Joi from 'joi'

import { statusCodes } from '#/server/common/constants/status-codes.js'
import {
  getPendingPasswordReset,
  passwordResetFailure,
  resendPasswordResetCode,
  setNewPassword,
  startPasswordReset,
  verifyPasswordResetCode
} from '#/server/common/helpers/auth/entra-password-reset.js'
import { recordPasswordResetRequest } from '#/server/common/helpers/auth/sign-in-throttle.js'

export const START_PATH = '/forgotten-password'
export const CODE_PATH = '/forgotten-password/code'
export const RESEND_PATH = '/forgotten-password/code/resend'
export const NEW_PASSWORD_PATH = '/forgotten-password/new-password'
export const COMPLETE_PATH = '/forgotten-password/complete'

const ERROR_FLASH_KEY = 'forgottenPasswordError'
const NOTICE_FLASH_KEY = 'forgottenPasswordNotice'
const COMPLETE_FLASH_KEY = 'forgottenPasswordComplete'
const MIN_PASSWORD_LENGTH = 8
const MAX_PASSWORD_LENGTH = 256
const MAX_CODE_LENGTH = 16

const failureMessageKeys = {
  [passwordResetFailure.invalidCode]: 'forgottenPassword.error.code.incorrect',
  [passwordResetFailure.tooManyCodeAttempts]:
    'forgottenPassword.error.code.tooManyAttempts',
  [passwordResetFailure.expired]: 'forgottenPassword.error.expired',
  [passwordResetFailure.passwordTooShort]:
    'forgottenPassword.error.password.tooShort',
  [passwordResetFailure.passwordTooLong]:
    'forgottenPassword.error.password.tooLong',
  [passwordResetFailure.passwordTooWeak]:
    'forgottenPassword.error.password.tooWeak',
  [passwordResetFailure.passwordRecentlyUsed]:
    'forgottenPassword.error.password.recentlyUsed',
  [passwordResetFailure.passwordBanned]:
    'forgottenPassword.error.password.banned'
}

const PASSWORD_REASONS = new Set([
  passwordResetFailure.passwordTooShort,
  passwordResetFailure.passwordTooLong,
  passwordResetFailure.passwordTooWeak,
  passwordResetFailure.passwordRecentlyUsed,
  passwordResetFailure.passwordBanned
])

function failureMessage(reason) {
  return t(failureMessageKeys[reason] ?? 'forgottenPassword.error.unavailable')
}

function errors(fieldErrors, summaryError) {
  const errorList = [
    ...Object.entries(fieldErrors).map(([field, text]) => ({
      text,
      href: `#${field}`
    })),
    ...(summaryError ? [{ text: summaryError }] : [])
  ]
  return errorList.length
    ? {
        fieldErrors,
        errorSummary: { titleText: t('common.errorSummary.title'), errorList }
      }
    : { fieldErrors }
}

// Reset pages carry one-time codes and new passwords, so they are never cached.
function render(h, template, context, statusCode = statusCodes.ok) {
  return h
    .view(`forgotten-password/${template}`, context)
    .code(statusCode)
    .header('Cache-Control', 'no-store')
}

function startView(request, h, { email, fieldErrors = {}, error } = {}, code) {
  const summaryError = error ?? request.yar.flash(ERROR_FLASH_KEY).at(-1)
  return render(
    h,
    'index',
    {
      pageTitle: t('forgottenPassword.reset.title'),
      heading: t('forgottenPassword.reset.title'),
      backLink: { href: '/sign-in', text: t('header.back') },
      email,
      ...errors(fieldErrors, summaryError)
    },
    code
  )
}

function codeView(request, h, { fieldErrors = {}, error } = {}, code) {
  return render(
    h,
    'code',
    {
      pageTitle: t('forgottenPassword.code.title'),
      heading: t('forgottenPassword.code.title'),
      notice: request.yar.flash(NOTICE_FLASH_KEY).at(-1),
      ...errors(fieldErrors, error)
    },
    code
  )
}

function newPasswordView(h, { fieldErrors = {}, error } = {}, code) {
  return render(
    h,
    'new-password',
    {
      pageTitle: t('forgottenPassword.newPassword.title'),
      heading: t('forgottenPassword.newPassword.title'),
      backLink: { href: CODE_PATH, text: t('header.back') },
      ...errors(fieldErrors, error)
    },
    code
  )
}

function restart(request, h, reason) {
  request.yar.flash(ERROR_FLASH_KEY, failureMessage(reason))
  return h.redirect(START_PATH).code(statusCodes.seeOther)
}

function logFailure(request, error, message) {
  const fields = {
    reason: error?.reason,
    errorCode: error?.errorCode,
    subError: error?.subError
  }
  if (error?.reason === passwordResetFailure.unavailable) {
    request.logger.error(fields, message)
  } else {
    request.logger.warn(fields, message)
  }
}

export const forgottenPasswordController = {
  handler(request, h) {
    return startView(request, h)
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

        return startView(
          request,
          h,
          { email, fieldErrors: { email: errorText } },
          statusCodes.badRequest
        ).takeover()
      }
    }
  },
  async handler(request, h) {
    const { email } = request.payload

    if (await recordPasswordResetRequest(request, email)) {
      request.logger.warn('Password reset requests limited for this address')
      return startView(
        request,
        h,
        { email, error: t('forgottenPassword.error.limited') },
        statusCodes.tooManyRequests
      )
    }

    try {
      await startPasswordReset(request, email)
      return h.redirect(CODE_PATH).code(statusCodes.seeOther)
    } catch (error) {
      logFailure(request, error, 'Password reset could not be started')
      return startView(
        request,
        h,
        { email, error: failureMessage(error?.reason) },
        statusCodes.serviceUnavailable
      )
    }
  }
}

export const forgottenPasswordCodeController = {
  handler(request, h) {
    if (!getPendingPasswordReset(request)) {
      return h.redirect(START_PATH).code(statusCodes.seeOther)
    }
    return codeView(request, h)
  }
}

export const forgottenPasswordCodeSubmitController = {
  async handler(request, h) {
    if (!getPendingPasswordReset(request)) {
      return restart(request, h, passwordResetFailure.expired)
    }

    const code = String(request.payload?.code ?? '').replace(/\s+/g, '')
    if (!code || code.length > MAX_CODE_LENGTH) {
      const text = code
        ? t('forgottenPassword.error.code.incorrect')
        : t('forgottenPassword.error.code.empty')
      return codeView(
        request,
        h,
        { fieldErrors: { code: text } },
        statusCodes.badRequest
      )
    }

    try {
      await verifyPasswordResetCode(request, code)
      return h.redirect(NEW_PASSWORD_PATH).code(statusCodes.seeOther)
    } catch (error) {
      logFailure(request, error, 'Password reset code was rejected')
      if (error?.reason === passwordResetFailure.invalidCode) {
        return codeView(
          request,
          h,
          { fieldErrors: { code: failureMessage(error.reason) } },
          statusCodes.badRequest
        )
      }
      return restart(request, h, error?.reason)
    }
  }
}

export const forgottenPasswordResendController = {
  async handler(request, h) {
    const pending = getPendingPasswordReset(request)
    if (!pending) {
      return restart(request, h, passwordResetFailure.expired)
    }

    if (await recordPasswordResetRequest(request, pending.email)) {
      request.logger.warn('Password reset requests limited for this address')
      return codeView(
        request,
        h,
        { error: t('forgottenPassword.error.limited') },
        statusCodes.tooManyRequests
      )
    }

    try {
      await resendPasswordResetCode(request)
      request.yar.flash(NOTICE_FLASH_KEY, t('forgottenPassword.code.resent'))
      return h.redirect(CODE_PATH).code(statusCodes.seeOther)
    } catch (error) {
      logFailure(request, error, 'Password reset code could not be resent')
      return restart(request, h, error?.reason)
    }
  }
}

export const forgottenPasswordNewPasswordController = {
  handler(request, h) {
    if (!getPendingPasswordReset(request)?.verified) {
      return h.redirect(START_PATH).code(statusCodes.seeOther)
    }
    return newPasswordView(h)
  }
}

function newPasswordProblem(password, confirmPassword) {
  const fieldErrors = {
    ...(!password && {
      password: t('forgottenPassword.error.password.empty')
    }),
    ...(!confirmPassword && {
      confirmPassword: t('forgottenPassword.error.password.confirmEmpty')
    })
  }
  if (Object.keys(fieldErrors).length) {
    return fieldErrors
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { password: t('forgottenPassword.error.password.tooShort') }
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return { password: t('forgottenPassword.error.password.tooLong') }
  }
  if (password !== confirmPassword) {
    return {
      confirmPassword: t('forgottenPassword.error.password.mismatch')
    }
  }
  return null
}

export const forgottenPasswordNewPasswordSubmitController = {
  async handler(request, h) {
    if (!getPendingPasswordReset(request)?.verified) {
      return restart(request, h, passwordResetFailure.expired)
    }

    const password = String(request.payload?.password ?? '')
    const confirmPassword = String(request.payload?.confirmPassword ?? '')
    const fieldErrors = newPasswordProblem(password, confirmPassword)
    if (fieldErrors) {
      return newPasswordView(h, { fieldErrors }, statusCodes.badRequest)
    }

    try {
      await setNewPassword(request, password)
      request.yar.flash(COMPLETE_FLASH_KEY, true)
      return h.redirect(COMPLETE_PATH).code(statusCodes.seeOther)
    } catch (error) {
      logFailure(request, error, 'New password was rejected')
      if (PASSWORD_REASONS.has(error?.reason)) {
        return newPasswordView(
          h,
          { fieldErrors: { password: failureMessage(error.reason) } },
          statusCodes.badRequest
        )
      }
      if (error?.reason === passwordResetFailure.expired) {
        return restart(request, h, error.reason)
      }
      return newPasswordView(
        h,
        { error: failureMessage(error?.reason) },
        statusCodes.serviceUnavailable
      )
    }
  }
}

export const forgottenPasswordCompleteController = {
  handler(request, h) {
    if (!request.yar.flash(COMPLETE_FLASH_KEY).at(-1)) {
      return h.redirect(START_PATH).code(statusCodes.seeOther)
    }
    return render(h, 'complete', {
      pageTitle: t('forgottenPassword.complete.title'),
      heading: t('forgottenPassword.complete.title')
    })
  }
}
