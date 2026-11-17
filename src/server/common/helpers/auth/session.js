// Signed-in state backed by the server-side @hapi/yar session cache. Only the
// signed-in flag, sign-in time and basic account details are stored here.
const SIGNED_IN_SESSION_KEY = 'signedIn'
const SIGNED_IN_AT_SESSION_KEY = 'signedInAt'
const ACCOUNT_SESSION_KEY = 'signedInAccount'

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

export function signIn(request, account, method = 'native') {
  if (account) {
    // A new session id on authentication prevents session fixation.
    request.yar.reset()
    request.yar.set(ACCOUNT_SESSION_KEY, {
      userId: account.userId ?? null,
      email: account.email,
      name: account.name,
      method
    })
  }
  request.yar.set(SIGNED_IN_SESSION_KEY, true)
  request.yar.set(SIGNED_IN_AT_SESSION_KEY, Date.now())
}

export function getSignedInAccount(request) {
  return isSignedIn(request) ? request.yar.get(ACCOUNT_SESSION_KEY) : null
}

export function isSessionExpired(request, maxAgeMs, now = Date.now()) {
  const signedInAt = request.yar.get(SIGNED_IN_AT_SESSION_KEY)
  return typeof signedInAt !== 'number' || now - signedInAt > maxAgeMs
}

// Clears the signed-in flag and the in-progress catch-record journey state.
export function signOut(request) {
  request.yar.reset()
}
