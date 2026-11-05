import Boom from '@hapi/boom'
import { config } from '#/config/config.js'

// Journey state helpers backed by the @hapi/yar session cache (no persistence beyond the session).
const JOURNEY_SESSION_KEY = 'journey'
const GEAR_SELECTION_PATH = '/gear-selection'
const STATISTICAL_AREA_PATH = '/statistical-area'
const STATISTICAL_AREA_OTHER_PATH = '/statistical-area-other'
const SPECIES_SELECTION_PATH = '/species-selection'
const CATCH_NOT_LANDED_PATH = '/catch-not-landed'
const SPECIES_NOT_LANDED_PATH = '/species-not-landed'
const CHECK_ANSWERS_PATH = '/check-answers'

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
  GEAR_SELECTION_PATH,
  '/add-gear',
  '/remove-gear',
  STATISTICAL_AREA_PATH,
  STATISTICAL_AREA_OTHER_PATH,
  SPECIES_SELECTION_PATH,
  '/add-species',
  '/remove-species',
  CATCH_NOT_LANDED_PATH,
  SPECIES_NOT_LANDED_PATH,
  CHECK_ANSWERS_PATH,
  '/confirmation',
  '/account',
  '/remove-port',
  '/not-implemented'
]

const DEFAULT_RETURN_PATH = '/records'
const FAVOURITE_KEYS = new Set([
  'favouriteGearIds',
  'favouriteGearMeasurements',
  'favouriteSpeciesIds',
  'availableSpeciesIds',
  'favouritePortIds',
  'favouritePorts',
  'accountPortsUsed'
])

function sessionKey(request) {
  const accountPage = [
    '/account',
    '/remove-port',
    '/add-skipper',
    '/skipper-details',
    '/skipper-check',
    '/skipper-confirmation',
    '/remove-skipper'
  ].includes(request.path)
  const accountFavouritePage =
    request.query?.return === '/account' &&
    [
      '/add-port',
      '/add-gear',
      '/remove-gear',
      '/add-species',
      '/remove-species'
    ].includes(request.path)
  if (
    config.get('catchRecording.enabled') &&
    (accountPage || accountFavouritePage)
  ) {
    const vesselId = request.query?.vesselId
    if (vesselId !== undefined) {
      if (
        typeof vesselId !== 'string' ||
        !vesselId.trim() ||
        vesselId.length > 200
      ) {
        throw Boom.badRequest('Select a valid vessel')
      }
      return `accountJourney:${vesselId}`
    }
    if (request.yar.get('accountJourney')) return 'accountJourney'
  }
  return JOURNEY_SESSION_KEY
}

export function getJourneyState(request) {
  const key = sessionKey(request)
  const state = request.yar.get(key) || {}
  if (!config.get('catchRecording.enabled')) return state
  const answers = Object.fromEntries(
    Object.entries(state).filter(([key]) => !FAVOURITE_KEYS.has(key))
  )
  const selectedVesselId = key.startsWith('accountJourney:')
    ? request.query.vesselId
    : state.selectedVesselId
  return {
    ...answers,
    ...(selectedVesselId ? { selectedVesselId } : {}),
    ...request.yar.get('vesselFavourites')?.[selectedVesselId || '']
  }
}

export function catchRecordCaption(request) {
  return getJourneyState(request).reference || 'New catch record'
}

export function isCatchRecordJourney(request) {
  return (
    config.get('catchRecording.enabled') &&
    request.query?.return !== '/account' &&
    Boolean(getJourneyState(request).catchRecordId)
  )
}

export function setJourneyState(request, patch) {
  const current = getJourneyState(request)
  const changingVessel =
    config.get('catchRecording.enabled') &&
    patch.selectedVesselId !== undefined &&
    patch.selectedVesselId !== current.selectedVesselId
  const state = changingVessel
    ? {
        ...Object.fromEntries(
          Object.entries(current).filter(([key]) => !FAVOURITE_KEYS.has(key))
        ),
        ...request.yar.get('vesselFavourites')?.[patch.selectedVesselId]
      }
    : current
  const merged = { ...state, ...patch }
  if (config.get('catchRecording.enabled')) {
    const vesselId = merged.selectedVesselId || ''
    request.yar.set('vesselFavourites', {
      ...request.yar.get('vesselFavourites'),
      [vesselId]: Object.fromEntries(
        Object.entries(merged).filter(([key]) => FAVOURITE_KEYS.has(key))
      )
    })
    request.yar.set(
      sessionKey(request),
      Object.fromEntries(
        Object.entries(merged).filter(([key]) => !FAVOURITE_KEYS.has(key))
      )
    )
    return merged
  }

  request.yar.set(sessionKey(request), merged)
  return merged
}

export function accountVesselPath(request, path) {
  if (
    !config.get('catchRecording.enabled') ||
    !request.query?.vesselId ||
    path === '/account'
  ) {
    return path
  }
  return `${path}${path.includes('?') ? '&' : '?'}vesselId=${encodeURIComponent(request.query.vesselId)}`
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
      ? STATISTICAL_AREA_OTHER_PATH
      : STATISTICAL_AREA_PATH,
    undefined,
    request.query?.return
  )
}

export function backForCheckAnswers(request) {
  const state = getJourneyState(request)
  return state.catchNotLanded ? SPECIES_NOT_LANDED_PATH : CATCH_NOT_LANDED_PATH
}

export function safeReturnPath(candidate) {
  return SAFE_RETURN_PATHS.includes(candidate) ? candidate : DEFAULT_RETURN_PATH
}

// Lets an edit page's successful submit send the user back to the page that linked to it
// (for example a Check Your Answers "Change" link) instead of always continuing the journey.
export function resolveNextPath(request, defaultPath) {
  const candidate = request.query && request.query.return
  if (
    candidate === CHECK_ANSWERS_PATH &&
    defaultPath === STATISTICAL_AREA_OTHER_PATH
  ) {
    return gearPath(request, defaultPath, undefined, candidate)
  }
  return candidate && SAFE_RETURN_PATHS.includes(candidate)
    ? gearPath(request, candidate)
    : gearPath(request, defaultPath)
}

const GEAR_PATHS = new Set([
  STATISTICAL_AREA_PATH,
  STATISTICAL_AREA_OTHER_PATH,
  SPECIES_SELECTION_PATH,
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

export function gearPath(request, path, gearId, returnPath) {
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
  if (returnPath === CHECK_ANSWERS_PATH) {
    params.set('return', returnPath)
  }
  // Keep the existing unescaped return-path convention.
  const querySuffix = params.size
    ? '?' + params.toString().replaceAll('%2F', '/')
    : ''
  return `${base}${querySuffix}`
}

export function gearPageContext(request) {
  const state = getJourneyState(request)
  const gearId = currentGearId(request)
  return {
    gearId,
    gearLabel: gearId
      ? state.gearLabelsById?.[gearId] ||
        state.selectedGearNamesById?.[gearId] ||
        gearId
      : null,
    legacyCatchNotice:
      state.selectedGearIds?.length > 1 &&
      CATCH_KEYS.some((key) => state[key] !== undefined) &&
      !state.catchDetailsByGearId?.[gearId]
        ? 'This trip has catch answers without a gear assigned. Enter the catch details for each gear; previous trip-level answers have not been copied.'
        : null
  }
}

export function speciesSelectionReturnPath(request) {
  if (request.query?.return !== CHECK_ANSWERS_PATH || !currentGearId(request)) {
    return resolveNextPath(request, SPECIES_SELECTION_PATH)
  }
  return gearPath(
    request,
    SPECIES_SELECTION_PATH,
    undefined,
    request.query?.return
  )
}

export function backForStatisticalArea(request) {
  if (request.query?.return === CHECK_ANSWERS_PATH) {
    return CHECK_ANSWERS_PATH
  }
  const state = getJourneyState(request)
  const index = state.selectedGearIds?.indexOf(currentGearId(request)) ?? -1
  if (index <= 0) {
    return GEAR_SELECTION_PATH
  }
  const previousId = state.selectedGearIds[index - 1]
  return gearPath(request, SPECIES_SELECTION_PATH, previousId)
}

function incompleteCatchPath(answers) {
  if (!answers.selectedStatisticalArea) {
    return STATISTICAL_AREA_PATH
  }
  if (
    answers.statAreaBranch === 'other' &&
    incompleteAlternativeArea(answers)
  ) {
    return STATISTICAL_AREA_OTHER_PATH
  }
  if (
    !answers.selectedSpeciesIds?.length ||
    answers.selectedSpeciesIds.some(
      (id) => !Number.isFinite(answers.speciesWeights?.[id]?.weightAboveMinimum)
    )
  ) {
    return SPECIES_SELECTION_PATH
  }
  return null
}

function incompleteAlternativeArea(answers) {
  return (
    !answers.selectedAlternativeAreaOption ||
    (answers.selectedAlternativeAreaOption === 'other' &&
      !answers.alternativeStatisticalArea)
  )
}

function incompleteUnlandedPath(request, state) {
  if (!state.selectedGearIds?.length) {
    return null
  }
  if (typeof state.catchNotLanded !== 'boolean') {
    return CATCH_NOT_LANDED_PATH
  }
  const caughtIds = caughtSpeciesIds(request)
  const entries = Object.entries(state.speciesNotLanded || {})
  if (
    state.catchNotLanded &&
    (!entries.length ||
      entries.some(
        ([id, weights]) =>
          !caughtIds.includes(id) ||
          !Number.isFinite(weights.weightAboveMinimum)
      ))
  ) {
    return SPECIES_NOT_LANDED_PATH
  }
  return null
}

export function incompleteGearPath(request) {
  const state = getJourneyState(request)
  if (Array.isArray(state.selectedGearIds) && !state.selectedGearIds.length) {
    return GEAR_SELECTION_PATH
  }
  for (const gearId of state.selectedGearIds || []) {
    const answers = getGearJourneyState({ ...request, query: { gearId } })
    const path = incompleteCatchPath(answers)
    if (path) {
      return gearPath(request, path, gearId)
    }
  }
  return incompleteUnlandedPath(request, state)
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
  if (request.query?.return === CHECK_ANSWERS_PATH) {
    return incompleteGearPath(request) || CHECK_ANSWERS_PATH
  }
  const index = state.selectedGearIds?.indexOf(currentGearId(request)) ?? -1
  const nextId = state.selectedGearIds?.[index + 1]
  return nextId
    ? gearPath(request, STATISTICAL_AREA_PATH, nextId)
    : CATCH_NOT_LANDED_PATH
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
    SPECIES_SELECTION_PATH,
    state.selectedGearIds?.at(-1),
    request.query?.return
  )
}
