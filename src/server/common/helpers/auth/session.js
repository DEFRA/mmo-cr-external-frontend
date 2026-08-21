// Minimal simulated sign-in flag backed by the @hapi/yar session cache — no real
// authentication, tokens or passwords. Frontend walkthrough only.
const SIGNED_IN_SESSION_KEY = 'signedIn'

// @hapi/yar only initialises request.yar (assigning a session id) during its
// onPreAuth lifecycle step, which is skipped for synthetic responses such as an
// unmatched-route 404 — treat an uninitialised session as signed out rather
// than calling yar.get(), which throws in that case.
export function isSignedIn(request) {
  if (!request?.yar?.id) {
    return false
  }

  return request.yar.get(SIGNED_IN_SESSION_KEY) === true
}

export function signIn(request) {
  request.yar.set(SIGNED_IN_SESSION_KEY, true)
}

// Clears the signed-in flag and the in-progress catch-record journey state.
export function signOut(request) {
  request.yar.reset()
}
