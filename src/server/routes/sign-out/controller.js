import { config } from '#/config/config.js'
import { createEntraLogoutUrl } from '#/server/common/helpers/auth/entra.js'
import { signOut } from '#/server/common/helpers/auth/session.js'

export const signOutController = {
  async handler(request, h) {
    signOut(request)

    if (config.get('authentication.mode') === 'entra') {
      try {
        const logoutUrl = await createEntraLogoutUrl()
        return h.redirect(logoutUrl).code(303)
      } catch (error) {
        request.server.log(['error', 'entra-auth'], {
          errorName: error?.name,
          errorCode: error?.errorCode,
          message: 'Unable to complete Entra sign-out'
        })
        request.yar.flash(
          'signOutWarning',
          'You have been signed out of this service. You may still be signed in to Microsoft.'
        )
      }
    }

    return h.redirect('/signed-out').code(303)
  }
}

export const signedOutController = {
  handler(request, h) {
    return h.view('sign-out/index', {
      pageTitle: 'You have been signed out',
      heading: 'You have been signed out',
      warning: request.yar.flash('signOutWarning').at(-1)
    })
  }
}
