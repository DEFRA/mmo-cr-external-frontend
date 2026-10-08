import Joi from 'joi'

import {
  backForDeparturePort,
  resolveNextPath
} from '#/server/common/helpers/journey/navigation.js'
import { addFavouritePortCode } from '#/server/common/helpers/journey/favourite-ports.js'
import { addAccountPortName } from '#/server/common/helpers/account/account-ports.js'
import {
  findPortByName,
  getPortCatalogue,
  portSearchLabel,
  rememberPortName
} from '#/server/common/helpers/ports/ports-list.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

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

function backLink(request) {
  if (isAccountReturn(request)) {
    return accountPath
  }

  const phase = resolvePhase(request)
  if (!isEntry(request)) {
    return phase === returnPhase ? '/return-port' : departurePortPath
  }

  return phase === returnPhase
    ? departurePortPath
    : backForDeparturePort(request)
}

function formAction(request) {
  const phase = resolvePhase(request)
  const entrySuffix = isEntry(request) ? '&entry=1' : ''
  const returnSuffix = isAccountReturn(request) ? '&return=/account' : ''
  return `/add-port?for=${phase}${entrySuffix}${returnSuffix}`
}

function viewContext(request, ports, overrides = {}) {
  const heading = headingByPhase[resolvePhase(request)]

  return {
    pageTitle: heading,
    heading,
    caption: 'New catch record',
    backLink: {
      href: backLink(request),
      text: 'Back'
    },
    formAction: formAction(request),
    portNames: ports.map((port) => portSearchLabel(port, ports)),
    port: '',
    ...overrides
  }
}

export const addPortController = {
  async handler(request, h) {
    const ports = await getPortCatalogue()
    return h.view('add-port/index', viewContext(request, ports))
  }
}

async function renderError(request, h, submittedValue, catalogue) {
  const ports = catalogue || (await getPortCatalogue())
  return h
    .view(
      'add-port/index',
      viewContext(request, ports, {
        errorSummary: {
          titleText: 'There is a problem',
          errorList: [{ text: selectionErrorText, href: '#port' }]
        },
        fieldErrors: { port: selectionErrorText },
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
        return renderError(request, h, request.payload.port)
      }
    }
  },
  async handler(request, h) {
    const ports = await getPortCatalogue()
    const { port } = request.payload
    const matchedPort = findPortByName(port, ports)

    if (!matchedPort) {
      return renderError(request, h, port, ports)
    }

    if (isAccountReturn(request)) {
      addAccountPortName(request, matchedPort.name)
      return h.redirect(accountPath).code(statusCodes.seeOther)
    }

    addFavouritePortCode(request, matchedPort.code)
    rememberPortName(request, matchedPort)

    if (isEntry(request)) {
      return h
        .redirect(`/confirm-same-port?port=${matchedPort.code}`)
        .code(statusCodes.seeOther)
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
