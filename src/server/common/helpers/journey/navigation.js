// Journey state helpers backed by the @hapi/yar session cache (no persistence beyond the session).
const JOURNEY_SESSION_KEY = 'journey'

// Allowlist of known internal route paths. Exact string match only — used to
// prevent an open redirect via the Empty Page's `return` query parameter.
const SAFE_RETURN_PATHS = [
  '/',
  '/privacy-notice',
  '/sign-in',
  '/records',
  '/draft',
  '/select-vessel',
  '/trip-date',
  '/trip-departure-date',
  '/trip-return-date',
  '/departure-port',
  '/return-port',
  '/add-port',
  '/confirm-same-port',
  '/gear-selection',
  '/statistical-area',
  '/statistical-area-other',
  '/species-selection',
  '/catch-not-landed',
  '/check-answers',
  '/confirmation',
  '/account',
  '/not-implemented'
]

const DEFAULT_RETURN_PATH = '/records'

export function getJourneyState(request) {
  return request.yar.get(JOURNEY_SESSION_KEY) || {}
}

export function setJourneyState(request, patch) {
  const merged = { ...getJourneyState(request), ...patch }
  request.yar.set(JOURNEY_SESSION_KEY, merged)
  return merged
}

export function backForDeparturePort(request) {
  return getJourneyState(request).tripSameDate === false
    ? '/trip-return-date'
    : '/trip-date'
}

export function backForSpeciesSelection(request) {
  return getJourneyState(request).statAreaBranch === 'other'
    ? '/statistical-area-other'
    : '/statistical-area'
}

export function safeReturnPath(candidate) {
  return SAFE_RETURN_PATHS.includes(candidate) ? candidate : DEFAULT_RETURN_PATH
}

// Lets an edit page's successful submit send the user back to the page that linked to it
// (for example a Check Your Answers "Change" link) instead of always continuing the journey.
export function resolveNextPath(request, defaultPath) {
  const candidate = request.query && request.query.return
  return candidate && SAFE_RETURN_PATHS.includes(candidate)
    ? candidate
    : defaultPath
}
