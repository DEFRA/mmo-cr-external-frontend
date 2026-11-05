// Port codes are a session projection of user favourites in live mode.
// Walkthrough mode stores them only in the session.
import { getJourneyState, setJourneyState } from './navigation.js'
import { liveCatchRecords } from './catch-record-service.js'

export function getFavouritePortCodes(request) {
  return getJourneyState(request).favouritePorts || []
}

export function previousPortForConfirmation(request) {
  const state = getJourneyState(request)
  if (liveCatchRecords()) {
    return state.catchRecordId &&
      !state.portSelectionStarted &&
      state.departurePort &&
      state.departurePort === state.returnPort
      ? state.departurePort
      : undefined
  }
  if (state.departurePort || state.portSelectionStarted) return undefined
  const codes = getFavouritePortCodes(request)
  const previous = request.yar.get('previousTripPort')
  const code = previous == null && codes.length === 1 ? codes[0] : previous
  return codes.includes(code) ? code : undefined
}

export function portSelectionPath(request, path) {
  return request.query.return === '/check-answers'
    ? `${path}${path.includes('?') ? '&' : '?'}return=/check-answers`
    : path
}

export function addFavouritePortCode(request, code) {
  const existing = getFavouritePortCodes(request)
  if (existing.includes(code)) {
    return existing
  }

  const updated = [...existing, code]
  setJourneyState(request, { favouritePorts: updated })
  return updated
}
