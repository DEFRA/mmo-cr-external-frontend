import { signIn } from '#/server/common/helpers/auth/session.js'

/**
 * Sign In has no real authentication in this step — Continue simply starts the
 * signed-in journey at the records list.
 */
export const signInController = {
  handler(_request, h) {
    return h.view('sign-in/index', {
      pageTitle: 'Sign in',
      heading: 'Sign in'
    })
  }
}

export const signInSubmitController = {
  handler(request, h) {
    signIn(request)

    return h.redirect('/records').code(303)
  }
}
