import Boom from '@hapi/boom'

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
  return gearPath(
    request,
    getGearJourneyState(request).statAreaBranch === 'other'
      ? '/statistical-area-other'
      : '/statistical-area',
    undefined,
    request.query?.return
  )
}

export function backForCheckAnswers(request) {
  const state = getJourneyState(request)
  return state.catchNotLanded ? '/species-not-landed' : '/catch-not-landed'
}

export function safeReturnPath(candidate) {
  return SAFE_RETURN_PATHS.includes(candidate) ? candidate : DEFAULT_RETURN_PATH
}

// Lets an edit page's successful submit send the user back to the page that linked to it
// (for example a Check Your Answers "Change" link) instead of always continuing the journey.
export function resolveNextPath(request, defaultPath) {
  const candidate = request.query && request.query.return
  if (
    candidate === '/check-answers' &&
    defaultPath === '/statistical-area-other'
  ) {
    return gearPath(request, defaultPath, undefined, candidate)
  }
  return candidate && SAFE_RETURN_PATHS.includes(candidate)
    ? gearPath(request, candidate)
    : gearPath(request, defaultPath)
}

const GEAR_PATHS = new Set([
  '/statistical-area',
  '/statistical-area-other',
  '/species-selection',
  '/add-species',
  '/remove-species'
])
const CATCH_KEYS = [
  'statAreaBranch',
  'selectedStatisticalArea',
  'selectedAlternativeAreaOption',
  'alternativeStatisticalArea',
  'alternativeStatisticalAreaCoordinates',
  'selectedSpeciesIds',
  'speciesWeights'
]

export function currentGearId(request) {
  const ids = getJourneyState(request).selectedGearIds || []
  const supplied = request.query?.gearId
  if (
    supplied !== undefined &&
    (typeof supplied !== 'string' || !ids.includes(supplied))
  ) {
    throw Boom.badRequest('Select a gear used on this trip')
  }
  return supplied || ids[0]
}

export function getGearJourneyState(request) {
  const state = getJourneyState(request)
  const gearId = currentGearId(request)
  if (!gearId) {
    return state
  }
  const shared = Object.fromEntries(
    Object.entries(state).filter(([key]) => !CATCH_KEYS.includes(key))
  )
  const legacy =
    state.selectedGearIds.length === 1 && !state.catchDetailsByGearId
      ? Object.fromEntries(
          CATCH_KEYS.filter((key) => Object.hasOwn(state, key)).map((key) => [
            key,
            state[key]
          ])
        )
      : {}
  const saved = Object.fromEntries(
    Object.entries(state.catchDetailsByGearId?.[gearId] || {}).filter(([key]) =>
      CATCH_KEYS.includes(key)
    )
  )
  return { ...shared, ...legacy, ...saved }
}

export function setGearJourneyState(request, patch) {
  const state = getJourneyState(request)
  const gearId = currentGearId(request)
  if (!gearId) {
    return setJourneyState(request, patch)
  }
  const current = getGearJourneyState(request)
  const answers = Object.fromEntries(
    CATCH_KEYS.filter((key) => Object.hasOwn(current, key)).map((key) => [
      key,
      current[key]
    ])
  )
  return setJourneyState(request, {
    catchDetailsByGearId: {
      ...state.catchDetailsByGearId,
      [gearId]: { ...answers, ...patch }
    }
  })
}

export function gearPath(
  request,
  path,
  gearId = undefined,
  returnPath = undefined
) {
  if (typeof path !== 'string') {
    return path
  }
  const [base, query = ''] = path.split('?')
  if (!GEAR_PATHS.has(base)) {
    return path
  }
  const id = gearId ?? (request.yar ? currentGearId(request) : undefined)
  const params = new URLSearchParams(query)
  if (id) {
    params.set('gearId', id)
  }
  if (returnPath === '/check-answers') {
    params.set('return', returnPath)
  }
  // Keep the existing unescaped return-path convention.
  return `${base}${params.size ? `?${params.toString().replaceAll('%2F', '/')}` : ''}`
}

export function gearPageContext(request) {
  const state = getJourneyState(request)
  const gearId = currentGearId(request)
  return {
    gearId,
    gearLabel: gearId ? state.gearLabelsById?.[gearId] || gearId : null,
    legacyCatchNotice:
      state.selectedGearIds?.length > 1 &&
      CATCH_KEYS.some((key) => state[key] !== undefined) &&
      !state.catchDetailsByGearId?.[gearId]
        ? 'This trip has catch answers without a gear assigned. Enter the catch details for each gear; previous trip-level answers have not been copied.'
        : null
  }
}

export function speciesSelectionReturnPath(request) {
  if (request.query?.return !== '/check-answers' || !currentGearId(request)) {
    return resolveNextPath(request, '/species-selection')
  }
  return gearPath(
    request,
    '/species-selection',
    undefined,
    request.query?.return
  )
}

export function backForStatisticalArea(request) {
  if (request.query?.return === '/check-answers') {
    return '/check-answers'
  }
  const state = getJourneyState(request)
  const index = state.selectedGearIds?.indexOf(currentGearId(request)) ?? -1
  if (index <= 0) {
    return '/gear-selection'
  }
  const previousId = state.selectedGearIds[index - 1]
  return gearPath(request, '/species-selection', previousId)
}

export function incompleteGearPath(request) {
  const state = getJourneyState(request)
  if (Array.isArray(state.selectedGearIds) && !state.selectedGearIds.length) {
    return '/gear-selection'
  }
  for (const gearId of state.selectedGearIds || []) {
    const scoped = { ...request, query: { gearId } }
    const answers = getGearJourneyState(scoped)
    if (!answers.selectedStatisticalArea) {
      return gearPath(request, '/statistical-area', gearId)
    }

    if (
      answers.statAreaBranch === 'other' &&
      (!answers.selectedAlternativeAreaOption ||
        (answers.selectedAlternativeAreaOption === 'other' &&
          !answers.alternativeStatisticalArea))
    ) {
      return gearPath(request, '/statistical-area-other', gearId)
    }
    if (
      !answers.selectedSpeciesIds?.length ||
      answers.selectedSpeciesIds.some(
        (id) =>
          !Number.isFinite(answers.speciesWeights?.[id]?.weightAboveMinimum)
      )
    ) {
      return gearPath(request, '/species-selection', gearId)
    }
  }
  if (state.selectedGearIds?.length) {
    if (typeof state.catchNotLanded !== 'boolean') {
      return '/catch-not-landed'
    }
    const caughtIds = caughtSpeciesIds(request)
    if (
      state.catchNotLanded &&
      (!Object.keys(state.speciesNotLanded || {}).length ||
        Object.entries(state.speciesNotLanded).some(
          ([id, weights]) =>
            !caughtIds.includes(id) ||
            !Number.isFinite(weights.weightAboveMinimum)
        ))
    ) {
      return '/species-not-landed'
    }
  }
  return null
}

export function catchDetailsForSelectedGears(request, gearIds) {
  const state = getJourneyState(request)
  const details = { ...state.catchDetailsByGearId }
  if (!state.catchDetailsByGearId && state.selectedGearIds?.length === 1) {
    details[state.selectedGearIds[0]] = Object.fromEntries(
      CATCH_KEYS.filter((key) => Object.hasOwn(state, key)).map((key) => [
        key,
        state[key]
      ])
    )
  }
  return Object.fromEntries(
    Object.entries(details).filter(([id]) => gearIds.includes(id))
  )
}

export function nextAfterGear(request) {
  const state = getJourneyState(request)
  if (request.query?.return === '/check-answers') {
    return incompleteGearPath(request) || '/check-answers'
  }
  const index = state.selectedGearIds?.indexOf(currentGearId(request)) ?? -1
  const nextId = state.selectedGearIds?.[index + 1]
  return nextId
    ? gearPath(request, '/statistical-area', nextId)
    : '/catch-not-landed'
}

export function caughtSpeciesIds(request) {
  const state = getJourneyState(request)
  return state.selectedGearIds?.length
    ? [
        ...new Set(
          state.selectedGearIds.flatMap(
            (gearId) =>
              getGearJourneyState({ ...request, query: { gearId } })
                .selectedSpeciesIds || []
          )
        )
      ]
    : state.selectedSpeciesIds || []
}

export function backForCatchNotLanded(request) {
  const state = getJourneyState(request)
  return gearPath(
    request,
    '/species-selection',
    state.selectedGearIds?.at(-1),
    request.query?.return
  )
}
