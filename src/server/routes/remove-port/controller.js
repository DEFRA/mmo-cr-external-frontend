import {
  getJourneyState,
  resolveNextPath,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import { getAccountPortsUsed } from '#/server/common/helpers/account/account-ports.js'
import { getData } from '#/server/common/data/get-data.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import {
  loadFavouritePorts,
  removeFavouritePorts
} from '#/server/common/helpers/journey/session-favourites.js'
import {
  getPortCatalogue,
  portSearchLabel
} from '#/server/common/helpers/ports/ports-list.js'
import { liveCatchRecords } from '#/server/common/helpers/journey/catch-record-service.js'

const headingLine1 = 'Remove ports from vessel'

function portCheckboxItems(portsUsed) {
  return portsUsed.map((port) => ({ value: port, text: port }))
}

function viewContext(request, overrides = {}, catalogue = []) {
  const portsUsed = getAccountPortsUsed(getJourneyState(request))
  const vesselName = liveCatchRecords()
    ? ''
    : getJourneyState(request).selectedVesselName ||
      getData('selectVessel').name
  const heading = liveCatchRecords()
    ? 'Remove ports from your favourites'
    : headingLine1

  return {
    pageTitle: `${heading} ${vesselName}`.trim(),
    headingLine1: heading,
    vesselName,
    backLink: {
      href: '/account',
      text: 'Back'
    },
    portCheckboxItems: liveCatchRecords()
      ? catalogue
          .filter((port) =>
            getJourneyState(request).favouritePortIds.includes(port.id)
          )
          .map((port) => ({
            value: port.id,
            text: portSearchLabel(port, catalogue)
          }))
      : portCheckboxItems(portsUsed),
    ...overrides
  }
}

function renderWithError(request, h, catalogue) {
  const errorText = 'Select the port you want to remove'

  return h
    .view(
      'remove-port/index',
      viewContext(
        request,
        {
          errorSummary: {
            titleText: 'There is a problem',
            errorList: [{ text: errorText, href: '#ports' }]
          },
          fieldErrors: { ports: errorText }
        },
        catalogue
      )
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
  async handler(request, h) {
    const catalogue = liveCatchRecords() ? await getPortCatalogue() : []
    await loadFavouritePorts(request, catalogue)
    return h.view('remove-port/index', viewContext(request, {}, catalogue))
  }
}

export const removePortSubmitController = {
  async handler(request, h) {
    const catalogue = liveCatchRecords() ? await getPortCatalogue() : []
    await loadFavouritePorts(request, catalogue)
    const journeyState = getJourneyState(request)
    const portsUsed = liveCatchRecords()
      ? journeyState.favouritePortIds
      : getAccountPortsUsed(journeyState)
    const requestedPorts = normalizePorts(request.payload.ports)
    const portsToRemove = requestedPorts.filter((port) =>
      portsUsed.includes(port)
    )

    if (portsToRemove.length === 0) {
      return renderWithError(request, h, catalogue)
    }

    const remainingPortsUsed = portsUsed.filter(
      (port) => !portsToRemove.includes(port)
    )

    if (liveCatchRecords()) {
      await removeFavouritePorts(
        request,
        [...new Set(portsToRemove)],
        catalogue
      )
    } else {
      setJourneyState(request, { accountPortsUsed: remainingPortsUsed })
    }

    return h
      .redirect(resolveNextPath(request, '/account'))
      .code(statusCodes.seeOther)
  }
}
