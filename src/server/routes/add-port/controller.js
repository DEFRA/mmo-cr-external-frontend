import Joi from 'joi'

import {
  backForDeparturePort,
  resolveNextPath
} from '#/server/common/helpers/journey/navigation.js'
import { addFavouritePortCode } from '#/server/common/helpers/journey/favourite-ports.js'
import { getData } from '#/server/common/data/get-data.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

const ports = getData('ports')
const selectionErrorText = 'Select a port from the list'

const headingByPhase = {
  departure: 'Enter the port or closest port you set off from',
  return: 'Enter the port or closest port you returned to'
}

function resolvePhase(request) {
  return request.query.for === 'return' ? 'return' : 'departure'
}

function isEntry(request) {
  return request.query.entry === '1'
}

function backLink(request) {
  const phase = resolvePhase(request)
  if (!isEntry(request)) {
    return phase === 'return' ? '/return-port' : '/departure-port'
  }

  return phase === 'return' ? '/departure-port' : backForDeparturePort(request)
}

function formAction(request) {
  const phase = resolvePhase(request)
  const entrySuffix = isEntry(request) ? '&entry=1' : ''
  return `/add-port?for=${phase}${entrySuffix}`
}

function viewContext(request, overrides = {}) {
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
    portNames: ports.map(({ name }) => name),
    port: '',
    ...overrides
  }
}

export const addPortController = {
  handler(request, h) {
    return h.view('add-port/index', viewContext(request))
  }
}

function renderError(request, h, submittedValue) {
  return h
    .view(
      'add-port/index',
      viewContext(request, {
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
      failAction(request, h) {
        return renderError(request, h, request.payload.port)
      }
    }
  },
  handler(request, h) {
    const { port } = request.payload
    const matchedPort = ports.find(
      ({ name }) => name.toLowerCase() === port.trim().toLowerCase()
    )

    if (!matchedPort) {
      return renderError(request, h, port)
    }

    addFavouritePortCode(request, matchedPort.code)

    if (isEntry(request)) {
      return h
        .redirect(`/confirm-same-port?port=${matchedPort.code}`)
        .code(303)
    }

    const phase = resolvePhase(request)
    return h
      .redirect(
        resolveNextPath(request, phase === 'return' ? '/return-port' : '/departure-port')
      )
      .code(303)
  }
}
