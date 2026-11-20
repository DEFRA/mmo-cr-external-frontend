import { config } from '#/config/config.js'
import {
  isSessionExpired,
  isSignedIn,
  signOut
} from '#/server/common/helpers/auth/session.js'
import { isEntraMode } from '#/server/common/helpers/auth/entra.js'

export const SIGN_IN_ERROR_FLASH_KEY = 'signInError'
export const SESSION_EXPIRED_MESSAGE =
  'Your session has expired. Sign in again to continue.'

const PUBLIC_PATHS = new Set([
  '/',
  '/cookies',
  '/privacy-notice',
  '/health',
  '/favicon.ico',
  '/sign-in',
  '/sign-in/code',
  '/sign-in/code/resend',
  '/auth/callback',
  '/sign-out',
  '/signed-out',
  '/forgotten-password',
  '/forgotten-password-confirmation'
])

function isPublicPath(path) {
  return (
    PUBLIC_PATHS.has(path) || path.startsWith(`${config.get('assetPath')}/`)
  )
}

/**
 * With Entra authentication, every route except the public allowlist requires
 * a signed-in session no older than the session lifetime.
 */
export const authGuard = {
  plugin: {
    name: 'auth-guard',
    register(server) {
      server.ext('onPreHandler', (request, h) => {
        if (!isEntraMode() || isPublicPath(request.path)) {
          return h.continue
        }

        if (isSignedIn(request)) {
          if (!isSessionExpired(request, config.get('session.cache.ttl'))) {
            return h.continue
          }
          signOut(request)
          request.yar.flash(SIGN_IN_ERROR_FLASH_KEY, SESSION_EXPIRED_MESSAGE)
        }

        return h.redirect('/sign-in').code(302).takeover()
      })
    }
  }
}
