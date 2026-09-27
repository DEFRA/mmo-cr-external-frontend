// "Ports used" removal has no real backend in this mock app - the working list lives in the
// session's journeyState, seeded from the account mock data so it keeps working unchanged
// until the user adds or removes a port (mirrors the favourite-gear/available-species pattern).
import { getData } from '#/server/common/data/get-data.js'
import {
  getJourneyState,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'

const { portsUsed: defaultPortsUsed } = getData('account')

export function getAccountPortsUsed(journeyState) {
  return journeyState.accountPortsUsed || defaultPortsUsed
}

export function addAccountPortName(request, portName) {
  const existing = getAccountPortsUsed(getJourneyState(request))
  if (existing.includes(portName)) {
    return existing
  }

  const updated = [...existing, portName]
  setJourneyState(request, { accountPortsUsed: updated })
  return updated
}
