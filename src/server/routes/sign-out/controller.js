import {
  getSignedInAccount,
  signOut
} from '#/server/common/helpers/auth/session.js'
import {
  createBrowserLogoutUrl,
  isEntraMode
} from '#/server/common/helpers/auth/entra.js'

export const signOutController = {
  handler(request, h) {
    const account = getSignedInAccount(request)
    signOut(request)

    // Only the browser fallback creates a Microsoft session that needs ending.
    const logoutUrl =
      isEntraMode() && account?.method === 'browser'
        ? createBrowserLogoutUrl()
        : null

    return h.redirect(logoutUrl ?? '/signed-out').code(303)
  }
}

export const signedOutController = {
  handler(_request, h) {
    return h.view('sign-out/index', {
      pageTitle: 'You have been signed out',
      heading: 'You have been signed out'
    })
  }
}
