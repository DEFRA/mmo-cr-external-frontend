import Joi from 'joi'

import {
  setJourneyState,
  resolveNextPath
} from '#/server/common/helpers/journey/navigation.js'
import {
  findPortByCode,
  getPortCatalogue,
  getPortItem,
  rememberPortName
} from '#/server/common/helpers/ports/ports-list.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

const departurePortPath = '/departure-port'

async function resolvePort(request) {
  const code = request.query.port
  if (!code) {
    return undefined
  }
  const ports = await getPortCatalogue()
  const port = findPortByCode(code, ports)
  return port ? getPortItem(port.id) : undefined
}

function heading(portName) {
  return `Was ${portName} the port or the closest port you set off from and returned to?`
}

function viewContext(_request, port, overrides = {}) {
  return {
    pageTitle: heading(port.name),
    heading: heading(port.name),
    caption: 'New catch record',
    backLink: {
      href: '/add-port?for=departure&entry=1',
      text: 'Back'
    },
    formAction: `/confirm-same-port?port=${port.code}`,
    ...overrides
  }
}

export const confirmSamePortController = {
  async handler(request, h) {
    const port = await resolvePort(request)
    if (!port) {
      return h.redirect(departurePortPath).code(statusCodes.seeOther)
    }

    return h.view('confirm-same-port/index', viewContext(request, port))
  }
}

export const confirmSamePortSubmitController = {
  options: {
    validate: {
      payload: Joi.object({
        confirmSamePort: Joi.string().valid('yes', 'no').required()
      }),
      async failAction(request, h) {
        const port = await resolvePort(request)
        if (!port) {
          return h
            .redirect(departurePortPath)
            .code(statusCodes.seeOther)
            .takeover()
        }

        const errorText = `Select whether ${port.name} was the port you set off from and returned to`

        return h
          .view(
            'confirm-same-port/index',
            viewContext(request, port, {
              errorSummary: {
                titleText: 'There is a problem',
                errorList: [{ text: errorText, href: '#confirmSamePort' }]
              },
              fieldErrors: { confirmSamePort: errorText }
            })
          )
          .code(statusCodes.badRequest)
          .takeover()
      }
    }
  },
  async handler(request, h) {
    const port = await resolvePort(request)
    if (!port) {
      return h.redirect(departurePortPath).code(statusCodes.seeOther)
    }

    if (request.payload.confirmSamePort === 'yes') {
      rememberPortName(request, port)
      setJourneyState(request, {
        departurePort: port.code,
        returnPort: port.code
      })

      return h
        .redirect(resolveNextPath(request, '/gear-selection'))
        .code(statusCodes.seeOther)
    }

    return h.redirect(departurePortPath).code(statusCodes.seeOther)
  }
}
