// Amendment (edit-catch-record) state helpers backed by the same @hapi/yar
// session used for the create journey, under a separate key.
const AMENDMENT_SESSION_KEY = 'amendment'

export function getAmendmentState(request) {
  return request.yar.get(AMENDMENT_SESSION_KEY) || {}
}

export function setAmendmentState(request, patch) {
  const merged = { ...getAmendmentState(request), ...patch }
  request.yar.set(AMENDMENT_SESSION_KEY, merged)
  return merged
}

export function clearAmendmentState(request) {
  request.yar.set(AMENDMENT_SESSION_KEY, undefined)
}
