// Live vessel-profile loading replaces this session projection; walkthrough
// mode keeps the fixture defaults until the user edits them.
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
