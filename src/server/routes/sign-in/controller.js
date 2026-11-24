import { t } from '#/server/common/helpers/i18n/translator.js'

import { signIn } from '#/server/common/helpers/auth/session.js'
import {
  completeBrowserSignIn,
  createBrowserSignInUrl,
  discardPendingSignIn,
  getPendingSignIn,
  isBrowserFallbackEnabled,
  isEntraMode,
  resendSignInCode,
  signInFailure,
  signInWithPassword,
  storeApiTokens,
  submitSignInCode
} from '#/server/common/helpers/auth/entra.js'
import {
  clearFailedSignIns,
  isSignInLocked,
  recordFailedSignIn
} from '#/server/common/helpers/auth/sign-in-throttle.js'
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
  locked:
    'You have tried to sign in too many times. Wait 15 minutes, then try again.',
  codeEmpty: 'Enter the code',
  invalidCode: 'The code you entered is incorrect',
  tooManyCodeAttempts:
    'You have entered the wrong code too many times. Sign in again.',
  codeResent: 'We have sent you a new code.',
  expired: 'Your sign in attempt has timed out. Sign in again.',
  cancelled: 'Sign in was cancelled. Try again.',
  unsupported:
    'You cannot sign in to this service with this account. Contact catchrecording@marinemanagement.org.uk for help.',
  unavailable: 'Sign in is temporarily unavailable. Try again later.'
}

const failureMessageKeys = {
  [signInFailure.invalidCredentials]: 'invalidCredentials',
  [signInFailure.invalidCode]: 'invalidCode',
  [signInFailure.tooManyCodeAttempts]: 'tooManyCodeAttempts',
  [signInFailure.expired]: 'expired',
  [signInFailure.cancelled]: 'cancelled',
  [signInFailure.browserRequired]: 'unsupported',
  [signInFailure.unsupported]: 'unsupported'
}

function failureMessage(reason) {
  return messages[failureMessageKeys[reason] ?? 'unavailable']
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
    pageTitle: t('signIn.button'),
    heading: t('signIn.button'),
    backLink: {
      href: '/guidance',
      text: t('header.back')
    },
    email,
    ...errorViewModel(fieldErrors, summaryError)
  })
}

function codeView(request, h, { fieldErrors = {}, notice } = {}) {
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
    notice,
    ...errorViewModel(fieldErrors)
  })
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

function completeSignIn(request, h, { account, apiTokens }, method) {
  signIn(request, account, method)
  storeApiTokens(request, apiTokens)
  return h.redirect('/records').code(statusCodes.seeOther)
}

function redirectToSignIn(request, h, reason) {
  request.yar.flash(SIGN_IN_ERROR_FLASH_KEY, failureMessage(reason))
  return h.redirect('/sign-in').code(statusCodes.seeOther)
}

// The callback URL carries a one-time authorization code, so it must not be cached or leaked via Referer.
function noStore(response) {
  return response
    .header('Cache-Control', 'no-store')
    .header('Referrer-Policy', 'no-referrer')
}

function toBrowserFallback(request, h, email) {
  if (!isBrowserFallbackEnabled()) {
    return null
  }
  return h
    .redirect(createBrowserSignInUrl(request, email))
    .code(statusCodes.seeOther)
}

export const signInController = {
  handler(request, h) {
    return signInView(request, h)
  }
}

function signInInputProblem(email, password) {
  const fieldErrors = {
    ...(!email && { email: messages.emailEmpty }),
    ...(!password && { password: messages.passwordEmpty })
  }

  if (Object.keys(fieldErrors).length) {
    return { fieldErrors }
  }

  if (
    email.length > MAX_EMAIL_LENGTH ||
    password.length > MAX_PASSWORD_LENGTH
  ) {
    return { error: messages.invalidCredentials }
  }

  return null
}

async function signInFailureResponse(request, h, error, email) {
  logFailure(request, error, 'Entra sign-in was rejected')

  if (error?.reason === signInFailure.browserRequired) {
    const fallback = toBrowserFallback(request, h, email)
    if (fallback) {
      return fallback
    }
  }

  if (error?.reason === signInFailure.invalidCredentials) {
    await recordFailedSignIn(request, email)
  }

  const unavailable = error?.reason === signInFailure.unavailable
  return signInView(request, h, {
    error: failureMessage(error?.reason),
    email
  }).code(unavailable ? statusCodes.serviceUnavailable : statusCodes.badRequest)
}

export const signInSubmitController = {
  async handler(request, h) {
    if (!isEntraMode()) {
      signIn(request)
      return h.redirect('/records').code(statusCodes.seeOther)
    }

    const email = String(request.payload?.email ?? '').trim()
    const password = String(request.payload?.password ?? '')
    const inputProblem = signInInputProblem(email, password)

    if (inputProblem) {
      return signInView(request, h, { ...inputProblem, email }).code(
        statusCodes.badRequest
      )
    }

    if (await isSignInLocked(request, email)) {
      request.logger.warn('Entra sign-in blocked after repeated failures')
      return signInView(request, h, { error: messages.locked, email }).code(
        statusCodes.tooManyRequests
      )
    }

    try {
      const result = await signInWithPassword(request, email, password)
      await clearFailedSignIns(request, email)

      if (result.codeRequired) {
        return h.redirect(CODE_PATH).code(statusCodes.seeOther)
      }

      return completeSignIn(request, h, result, 'native')
    } catch (error) {
      return signInFailureResponse(request, h, error, email)
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

    const { email } = getPendingSignIn(request)

    try {
      const result = await submitSignInCode(request, code)
      return completeSignIn(request, h, result, 'native')
    } catch (error) {
      logFailure(request, error, 'Entra sign-in code was rejected')

      if (error?.reason === signInFailure.invalidCode) {
        return codeView(request, h, {
          fieldErrors: { code: messages.invalidCode }
        }).code(statusCodes.badRequest)
      }

      if (error?.reason === signInFailure.browserRequired) {
        const fallback = toBrowserFallback(request, h, email)
        if (fallback) {
          return fallback
        }
      }

      discardPendingSignIn(request)
      return redirectToSignIn(request, h, error?.reason)
    }
  }
}

export const signInCodeResendController = {
  async handler(request, h) {
    if (!isEntraMode() || !getPendingSignIn(request)) {
      return h.redirect('/sign-in').code(statusCodes.seeOther)
    }

    try {
      await resendSignInCode(request)
      return codeView(request, h, { notice: messages.codeResent })
    } catch (error) {
      logFailure(request, error, 'Entra sign-in code could not be resent')
      return redirectToSignIn(request, h, error?.reason)
    }
  }
}

export const authCallbackController = {
  async handler(request, h) {
    if (!isEntraMode() || !isBrowserFallbackEnabled()) {
      return h.redirect('/sign-in').code(statusCodes.seeOther)
    }

    try {
      const result = await completeBrowserSignIn(request, request.query)
      return noStore(completeSignIn(request, h, result, 'browser'))
    } catch (error) {
      logFailure(request, error, 'Entra browser sign-in was rejected')
      return noStore(redirectToSignIn(request, h, error?.reason))
    }
  }
}
