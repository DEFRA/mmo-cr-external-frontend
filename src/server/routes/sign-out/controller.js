import { signOut } from '#/server/common/helpers/auth/session.js'

export const signOutController = {
  handler(request, h) {
    signOut(request)

    return h.redirect('/signed-out').code(303)
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
