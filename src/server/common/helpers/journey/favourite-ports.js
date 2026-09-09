// Tracks the ports a user has searched for and saved this session, mirroring the iOS app's
// on-device favourite-ports store (see mmo-cr-ios FavouritePortsProviding) - offline-first, no
// persistence beyond the session here.
import { getJourneyState, setJourneyState } from './navigation.js'

export function getFavouritePortCodes(request) {
  return getJourneyState(request).favouritePorts || []
}

export function addFavouritePortCode(request, code) {
  const existing = getFavouritePortCodes(request)
  if (existing.includes(code)) return existing

  const updated = [...existing, code]
  setJourneyState(request, { favouritePorts: updated })
  return updated
}
