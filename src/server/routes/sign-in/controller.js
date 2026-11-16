import { signIn } from '#/server/common/helpers/auth/session.js'
import {
  discardPendingSignIn,
  getPendingSignIn,
  isEntraMode,
  signInFailure,
  signInWithPassword,
  submitSignInCode
} from '#/server/common/helpers/auth/entra.js'
import { SIGN_IN_ERROR_FLASH_KEY } from '#/server/plugins/auth-guard.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

const CODE_PATH = '/sign-in/code'
const MAX_EMAIL_LENGTH = 254
const MAX_PASSWORD_LENGTH = 256
const MAX_CODE_LENGTH = 16

const messages = {
  emailEmpty: 'Enter your email address',
  passwordEmpty: 'Enter your password',
  invalidCredentials: 'The email address or password you entered is incorrect',
  codeEmpty: 'Enter the code',
  invalidCode: 'The code you entered is incorrect',
  expired: 'Your sign in attempt has timed out. Sign in again.',
  unsupported:
    'You cannot sign in to this service with this account. Contact catchrecording@marinemanagement.org.uk for help.',
  unavailable: 'Sign in is temporarily unavailable. Try again later.'
}

function errorViewModel(fieldErrors, summaryError) {
  const errorList = [
    ...Object.entries(fieldErrors).map(([field, text]) => ({
      text,
      href: `#${field}`
    })),
    ...(summaryError ? [{ text: summaryError }] : [])
  ]

  return {
    fieldErrors,
    errorSummary: errorList.length
      ? { titleText: 'There is a problem', errorList }
      : null
  }
}

function signInView(request, h, { fieldErrors = {}, error, email } = {}) {
  const summaryError =
    error ?? request.yar.flash(SIGN_IN_ERROR_FLASH_KEY).at(-1)

  return h.view('sign-in/index', {
    pageTitle: 'Sign in',
    heading: 'Sign in',
    backLink: {
      href: '/guidance',
      text: 'Back'
    },
    email,
    ...errorViewModel(fieldErrors, summaryError)
  })
}

function codeView(request, h, { fieldErrors = {} } = {}) {
  const pending = getPendingSignIn(request)

  return h.view('sign-in/code', {
    pageTitle: 'Check your email',
    heading: 'Check your email',
    backLink: {
      href: '/sign-in',
      text: 'Back'
    },
    sentTo: pending?.sentTo,
    codeLength: pending?.codeLength,
    ...errorViewModel(fieldErrors)
  })
}

function failureMessage(reason) {
  return messages[
    {
      [signInFailure.invalidCredentials]: 'invalidCredentials',
      [signInFailure.invalidCode]: 'invalidCode',
      [signInFailure.expired]: 'expired',
      [signInFailure.unsupported]: 'unsupported'
    }[reason] ?? 'unavailable'
  ]
}

function logFailure(request, error, message) {
  const fields = {
    reason: error?.reason,
    errorCode: error?.errorCode,
    subError: error?.subError
  }

  if (error?.reason === signInFailure.unavailable) {
    request.logger.error(fields, message)
  } else {
    request.logger.warn(fields, message)
  }
}

function completeSignIn(request, h, account) {
  signIn(request, account)
  return h.redirect('/records').code(statusCodes.seeOther)
}

export const signInController = {
  handler(request, h) {
    return signInView(request, h)
  }
}

export const signInSubmitController = {
  async handler(request, h) {
    if (!isEntraMode()) {
      signIn(request)
      return h.redirect('/records').code(statusCodes.seeOther)
    }

    const email = String(request.payload?.email ?? '').trim()
    const password = String(request.payload?.password ?? '')
    const fieldErrors = {
      ...(!email && { email: messages.emailEmpty }),
      ...(!password && { password: messages.passwordEmpty })
    }

    if (Object.keys(fieldErrors).length) {
      return signInView(request, h, { fieldErrors, email }).code(
        statusCodes.badRequest
      )
    }

    if (
      email.length > MAX_EMAIL_LENGTH ||
      password.length > MAX_PASSWORD_LENGTH
    ) {
      return signInView(request, h, {
        error: messages.invalidCredentials,
        email
      }).code(statusCodes.badRequest)
    }

    try {
      const result = await signInWithPassword(request, email, password)

      if (result.codeRequired) {
        return h.redirect(CODE_PATH).code(statusCodes.seeOther)
      }

      return completeSignIn(request, h, result.account)
    } catch (error) {
      logFailure(request, error, 'Entra sign-in was rejected')
      const unavailable = error?.reason === signInFailure.unavailable

      return signInView(request, h, {
        error: failureMessage(error?.reason),
        email
      }).code(
        unavailable ? statusCodes.serviceUnavailable : statusCodes.badRequest
      )
    }
  }
}

export const signInCodeController = {
  handler(request, h) {
    if (!isEntraMode() || !getPendingSignIn(request)) {
      return h.redirect('/sign-in').code(statusCodes.seeOther)
    }

    return codeView(request, h)
  }
}

export const signInCodeSubmitController = {
  async handler(request, h) {
    if (!isEntraMode() || !getPendingSignIn(request)) {
      return h.redirect('/sign-in').code(statusCodes.seeOther)
    }

    const code = String(request.payload?.code ?? '').replace(/\s+/g, '')

    if (!code || code.length > MAX_CODE_LENGTH) {
      return codeView(request, h, {
        fieldErrors: {
          code: code ? messages.invalidCode : messages.codeEmpty
        }
      }).code(statusCodes.badRequest)
    }

    try {
      const { account } = await submitSignInCode(request, code)
      return completeSignIn(request, h, account)
    } catch (error) {
      logFailure(request, error, 'Entra sign-in code was rejected')

      if (error?.reason === signInFailure.invalidCode) {
        return codeView(request, h, {
          fieldErrors: { code: messages.invalidCode }
        }).code(statusCodes.badRequest)
      }

      discardPendingSignIn(request)
      request.yar.flash(SIGN_IN_ERROR_FLASH_KEY, failureMessage(error?.reason))
      return h.redirect('/sign-in').code(statusCodes.seeOther)
    }
  }
}
