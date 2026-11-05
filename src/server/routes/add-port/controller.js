import Joi from 'joi'

import {
  catchRecordCaption,
  accountVesselPath,
  backForDeparturePort,
  getJourneyState,
  resolveNextPath,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import {
  addFavouritePortCode,
  getFavouritePortCodes,
  previousPortForConfirmation,
  portSelectionPath
} from '#/server/common/helpers/journey/favourite-ports.js'
import {
  addAccountPortName,
  getAccountPortsUsed
} from '#/server/common/helpers/account/account-ports.js'
import {
  findPortByCode,
  findPortByName,
  getPortCatalogue,
  portSearchLabel,
  rememberPortName
} from '#/server/common/helpers/ports/ports-list.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import {
  loadFavouritePorts,
  addFavouritePort
} from '#/server/common/helpers/journey/session-favourites.js'
import { liveCatchRecords } from '#/server/common/helpers/journey/catch-record-service.js'

const selectionErrorText = 'Select a port from the list'
const returnPhase = 'return'
const departurePortPath = '/departure-port'
const accountPath = '/account'

const headingByPhase = {
  departure: 'Enter the port or closest port you set off from',
  return: 'Enter the port or closest port you returned to'
}

function resolvePhase(request) {
  return request.query.for === returnPhase ? returnPhase : 'departure'
}

function isEntry(request) {
  return request.query.entry === '1'
}

function isAccountReturn(request) {
  return request.query.return === accountPath
}

function isTripSelection(request) {
  return Boolean(request.query.for) && !isAccountReturn(request)
}

function backLink(request) {
  if (isAccountReturn(request)) {
    return accountPath
  }

  const phase = resolvePhase(request)
  if (
    liveCatchRecords() &&
    isTripSelection(request) &&
    getFavouritePortCodes(request).length === 0
  ) {
    return phase === returnPhase
      ? departurePortPath
      : backForDeparturePort(request)
  }
  if (!isEntry(request)) {
    return phase === returnPhase ? '/return-port' : departurePortPath
  }

  return phase === returnPhase
    ? departurePortPath
    : backForDeparturePort(request)
}

function formAction(request) {
  if (
    liveCatchRecords() &&
    !request.query.for &&
    !isEntry(request) &&
    !isAccountReturn(request)
  ) {
    return '/add-port'
  }
  const phase = resolvePhase(request)
  const entrySuffix = isEntry(request) ? '&entry=1' : ''
  const returnSuffix = isAccountReturn(request) ? '&return=/account' : ''
  return accountVesselPath(
    request,
    portSelectionPath(
      request,
      `/add-port?for=${phase}${entrySuffix}${returnSuffix}`
    )
  )
}

function viewContext(request, ports, overrides = {}) {
  const favouritesPage =
    liveCatchRecords() &&
    (isAccountReturn(request) || (!request.query.for && !isEntry(request)))
  const heading = favouritesPage
    ? 'Add a port to your favourites'
    : headingByPhase[resolvePhase(request)]
  const state = getJourneyState(request)
  const selectedCode =
    resolvePhase(request) === returnPhase
      ? state.returnPort
      : state.departurePort
  const selected =
    liveCatchRecords() && isTripSelection(request)
      ? findPortByCode(selectedCode, ports)
      : undefined

  return {
    pageTitle: heading,
    heading,
    caption: favouritesPage ? 'Your favourites' : catchRecordCaption(request),
    backLink: {
      href: backLink(request),
      text: 'Back'
    },
    formAction: formAction(request),
    portNames: ports.map((port) => portSearchLabel(port, ports)),
    port: selected ? portSearchLabel(selected, ports) : '',
    ...overrides
  }
}

export const addPortController = {
  async handler(request, h) {
    const ports = await getPortCatalogue()
    await loadFavouritePorts(request, ports)
    if (
      isEntry(request) &&
      !isAccountReturn(request) &&
      resolvePhase(request) === 'departure'
    ) {
      const previousPort = previousPortForConfirmation(request)
      if (previousPort) {
        return h
          .redirect(
            portSelectionPath(
              request,
              `/confirm-same-port?port=${encodeURIComponent(previousPort)}`
            )
          )
          .code(statusCodes.seeOther)
      }
    }
    return h.view('add-port/index', viewContext(request, ports))
  }
}

async function renderError(
  request,
  h,
  submittedValue,
  catalogue,
  errorText = selectionErrorText
) {
  const ports = catalogue || (await getPortCatalogue())
  return h
    .view(
      'add-port/index',
      viewContext(request, ports, {
        errorSummary: {
          titleText: 'There is a problem',
          errorList: [{ text: errorText, href: '#port' }]
        },
        fieldErrors: { port: errorText },
        port: submittedValue || ''
      })
    )
    .code(statusCodes.badRequest)
    .takeover()
}

export const addPortSubmitController = {
  options: {
    validate: {
      payload: Joi.object({
        port: Joi.string().trim().allow('').default('')
      }),
      async failAction(request, h) {
        await loadFavouritePorts(request)
        return renderError(request, h, request.payload.port)
      }
    }
  },
  async handler(request, h) {
    const ports = await getPortCatalogue()
    await loadFavouritePorts(request, ports)
    const { port } = request.payload
    const matchedPort = findPortByName(port, ports)

    if (!matchedPort) {
      return renderError(request, h, port, ports)
    }

    if (liveCatchRecords() && isTripSelection(request)) {
      const returning = resolvePhase(request) === returnPhase
      rememberPortName(request, matchedPort)
      setJourneyState(request, {
        [returning ? 'returnPort' : 'departurePort']: matchedPort.code,
        portSelectionStarted: true
      })
      return h
        .redirect(
          resolveNextPath(
            request,
            returning ? '/gear-selection' : '/return-port'
          )
        )
        .code(statusCodes.seeOther)
    }

    const alreadySaved = liveCatchRecords()
      ? getJourneyState(request).favouritePortIds.includes(matchedPort.id)
      : isAccountReturn(request)
        ? getAccountPortsUsed(getJourneyState(request)).includes(
            matchedPort.name
          )
        : getFavouritePortCodes(request).some(
            (code) => findPortByCode(code, ports)?.code === matchedPort.code
          )

    if (alreadySaved) {
      return renderError(
        request,
        h,
        port,
        ports,
        `${matchedPort.name} is already saved in your favourites`
      )
    }

    if (liveCatchRecords()) {
      await addFavouritePort(request, matchedPort.id, ports)
    }

    if (isAccountReturn(request)) {
      if (!liveCatchRecords()) {
        addAccountPortName(request, matchedPort.name)
      }
      return h.redirect(accountPath).code(statusCodes.seeOther)
    }

    if (!liveCatchRecords()) {
      addFavouritePortCode(request, matchedPort.code)
    }
    rememberPortName(request, matchedPort)

    if (isEntry(request)) {
      setJourneyState(request, { portSelectionStarted: true })
      return h.redirect(departurePortPath).code(statusCodes.seeOther)
    }

    const phase = resolvePhase(request)
    return h
      .redirect(
        resolveNextPath(
          request,
          phase === returnPhase ? '/return-port' : departurePortPath
        )
      )
      .code(statusCodes.seeOther)
  }
}
