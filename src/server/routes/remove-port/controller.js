import {
  getJourneyState,
  resolveNextPath,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import { getAccountPortsUsed } from '#/server/common/helpers/account/account-ports.js'
import { getData } from '#/server/common/data/get-data.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

const { name: vesselName } = getData('selectVessel')
const headingLine1 = 'Remove ports from vessel'

function portCheckboxItems(portsUsed) {
  return portsUsed.map((port) => ({ value: port, text: port }))
}

function viewContext(request, overrides = {}) {
  const portsUsed = getAccountPortsUsed(getJourneyState(request))

  return {
    pageTitle: `${headingLine1} ${vesselName}`,
    headingLine1,
    vesselName,
    backLink: {
      href: '/account',
      text: 'Back'
    },
    portCheckboxItems: portCheckboxItems(portsUsed),
    ...overrides
  }
}

function renderWithError(request, h) {
  const errorText = 'Select the port you want to remove'

  return h
    .view(
      'remove-port/index',
      viewContext(request, {
        errorSummary: {
          titleText: 'There is a problem',
          errorList: [{ text: errorText, href: '#ports' }]
        },
        fieldErrors: { ports: errorText }
      })
    )
    .code(statusCodes.badRequest)
    .takeover()
}

function normalizePorts(rawValue) {
  if (rawValue === undefined) {
    return []
  }

  return Array.isArray(rawValue) ? rawValue : [rawValue]
}

export const removePortController = {
  handler(request, h) {
    return h.view('remove-port/index', viewContext(request))
  }
}

export const removePortSubmitController = {
  handler(request, h) {
    const journeyState = getJourneyState(request)
    const portsUsed = getAccountPortsUsed(journeyState)
    const requestedPorts = normalizePorts(request.payload.ports)
    const portsToRemove = requestedPorts.filter((port) =>
      portsUsed.includes(port)
    )

    if (portsToRemove.length === 0) {
      return renderWithError(request, h)
    }

    const remainingPortsUsed = portsUsed.filter(
      (port) => !portsToRemove.includes(port)
    )

    setJourneyState(request, { accountPortsUsed: remainingPortsUsed })

    return h
      .redirect(resolveNextPath(request, '/account'))
      .code(statusCodes.seeOther)
  }
}
