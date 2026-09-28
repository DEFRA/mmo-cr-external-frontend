// Journey state helpers backed by the @hapi/yar session cache (no persistence beyond the session).
const JOURNEY_SESSION_KEY = 'journey'

// Allowlist of known internal route paths. Exact string match only — used to
// prevent an open redirect via the Empty Page's `return` query parameter.
const SAFE_RETURN_PATHS = new Set([
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
  '/add-gear',
  '/remove-gear',
  '/statistical-area',
  '/statistical-area-other',
  '/species-selection',
  '/add-species',
  '/remove-species',
  '/catch-not-landed',
  '/species-not-landed',
  '/check-answers',
  '/confirmation',
  '/account',
  '/remove-port',
  '/not-implemented'
])

const DEFAULT_RETURN_PATH = '/records'

function restoreAutosaveField(restored, key, value) {
  if (key === 'tripSameDate') {
    restored.tripSameDate = value === 'yes'
  } else if (key === 'gearIds') {
    restored.selectedGearIds = Array.isArray(value) ? value : [value]
  } else if (key === 'speciesIds') {
    restored.selectedSpeciesIds = Array.isArray(value) ? value : [value]
  } else if (key.startsWith('tripDepartureDate-')) {
    const suffix = key.replace('tripDepartureDate-', '')
    restored.tripDepartureDate ??= {}
    restored.tripDepartureDate[suffix] = value
  } else if (key.startsWith('tripReturnDate-')) {
    const suffix = key.replace('tripReturnDate-', '')
    restored.tripReturnDate ??= {}
    restored.tripReturnDate[suffix] = value
  } else {
    restored[key] = value
  }
}

function restoreAutosaveFields(fields = {}) {
  const restored = Object.create(null)

  Object.entries(fields).forEach(([key, value]) => {
    restoreAutosaveField(restored, key, value)
  })

  return restored
}

export function getJourneyState(request) {
  if (!request?.yar) {
    return {}
  }

  const state = request.yar.get(JOURNEY_SESSION_KEY) || {}
  const autosave = state.autosave

  if (!autosave || !request.path || autosave.path !== request.path) {
    return state
  }

  return { ...state, ...restoreAutosaveFields(autosave.fields) }
}

export function setJourneyState(request, patch) {
  if (!request?.yar) {
    return patch
  }

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

export function backForCheckAnswers(request) {
  return getJourneyState(request).catchNotLanded
    ? '/species-not-landed'
    : '/catch-not-landed'
}

export function safeReturnPath(candidate) {
  return SAFE_RETURN_PATHS.has(candidate) ? candidate : DEFAULT_RETURN_PATH
}

// Lets an edit page's successful submit send the user back to the page that linked to it
// (for example a Check Your Answers "Change" link) instead of always continuing the journey.
export function resolveNextPath(request, defaultPath) {
  const candidate = request.query?.return
  return candidate && SAFE_RETURN_PATHS.has(candidate) ? candidate : defaultPath
}
