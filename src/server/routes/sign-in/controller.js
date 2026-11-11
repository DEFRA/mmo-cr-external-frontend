import { config } from '#/config/config.js'
import { signIn } from '#/server/common/helpers/auth/session.js'
import {
  completeEntraAuthorization,
  createEntraAuthorizationUrl,
  validateEntraAuthorizationState
} from '#/server/common/helpers/auth/entra.js'

const SIGN_IN_ERROR_KEY = 'signInError'

function signInView(request, h, overrides = {}) {
  const signInError =
    overrides.signInError ?? request.yar.flash(SIGN_IN_ERROR_KEY).at(-1)

  return h.view('sign-in/index', {
    pageTitle: 'Sign in',
    heading: 'Sign in',
    backLink: {
      href: '/guidance',
      text: 'Back'
    },
    authenticationMode: config.get('authentication.mode'),
    signInError,
    errorSummary: signInError
      ? {
          titleText: 'There is a problem',
          errorList: [{ text: signInError }]
        }
      : null
  })
}

function callbackRedirect(response) {
  return response
    .header('Cache-Control', 'no-store')
    .header('Referrer-Policy', 'no-referrer')
}

export const signInController = {
  handler(request, h) {
    return signInView(request, h)
  }
}

export const signInSubmitController = {
  async handler(request, h) {
    if (config.get('authentication.mode') === 'entra') {
      try {
        const authorizationUrl = await createEntraAuthorizationUrl(request)
        return h.redirect(authorizationUrl).code(303)
      } catch (error) {
        request.server.log(['error', 'entra-auth'], {
          errorName: error?.name,
          errorCode: error?.errorCode,
          message: 'Unable to start Entra sign-in'
        })
        return signInView(request, h, {
          signInError: 'Sign in is temporarily unavailable. Try again later.'
        }).code(503)
      }
    }

    signIn(request)
    return h.redirect('/records').code(303)
  }
}

export const entraCallbackController = {
  async handler(request, h) {
    const callback = request.query

    if (callback.error) {
      try {
        validateEntraAuthorizationState(request, callback.state)
      } catch {
        request.server.log(
          ['warn', 'entra-auth'],
          'Entra sign-in callback state was invalid'
        )
        request.yar.flash(
          SIGN_IN_ERROR_KEY,
          'We could not sign you in. Try again.'
        )
        return callbackRedirect(h.redirect('/sign-in').code(303))
      }

      request.yar.flash(
        SIGN_IN_ERROR_KEY,
        'Sign in could not be completed. Try again.'
      )
      return callbackRedirect(h.redirect('/sign-in').code(303))
    }

    try {
      const account = await completeEntraAuthorization(request, callback)
      signIn(request, account)
      return callbackRedirect(h.redirect('/records').code(303))
    } catch (error) {
      request.server.log(['error', 'entra-auth'], {
        errorName: error?.name,
        errorCode: error?.errorCode,
        message: 'Entra sign-in callback failed'
      })
      request.yar.flash(
        SIGN_IN_ERROR_KEY,
        'We could not sign you in. Try again.'
      )
      return callbackRedirect(h.redirect('/sign-in').code(303))
    }
  }
}
