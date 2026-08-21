import { signOut } from '#/server/common/helpers/auth/session.js'

export const signOutController = {
  handler(request, h) {
    signOut(request)

    return h.redirect('/').code(303)
  }
}
