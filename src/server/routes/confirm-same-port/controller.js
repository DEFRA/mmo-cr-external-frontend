import Joi from 'joi'

import { setJourneyState, resolveNextPath } from '#/server/common/helpers/journey/navigation.js'
import { getData } from '#/server/common/data/get-data.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

const ports = getData('ports')

function resolvePort(request) {
  const code = request.query.port
  return ports.find((port) => port.code === code)
}

function heading(portName) {
  return `Was ${portName} the port or the closest port you set off from and returned to?`
}

function viewContext(request, port, overrides = {}) {
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
  handler(request, h) {
    const port = resolvePort(request)
    if (!port) {
      return h.redirect('/departure-port').code(303)
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
      failAction(request, h) {
        const port = resolvePort(request)
        if (!port) {
          return h.redirect('/departure-port').code(303).takeover()
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
  handler(request, h) {
    const port = resolvePort(request)
    if (!port) {
      return h.redirect('/departure-port').code(303)
    }

    if (request.payload.confirmSamePort === 'yes') {
      setJourneyState(request, {
        departurePort: port.code,
        returnPort: port.code
      })

      return h.redirect(resolveNextPath(request, '/gear-selection')).code(303)
    }

    return h.redirect('/departure-port').code(303)
  }
}
