import Joi from 'joi'

import {
  backForDeparturePort,
  getJourneyState,
  resolveNextPath,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import {
  addFavouritePortCode,
  getFavouritePortCodes
} from '#/server/common/helpers/journey/favourite-ports.js'
import {
  findPortByCode,
  getPortCatalogue,
  migratePortJourneyState,
  rememberPortName
} from '#/server/common/helpers/ports/ports-list.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

const pageTitle = 'Select the port you left from'
const errorSummaryTitle = 'There is a problem'
const hintText = 'Select a port name or the nearest port to where you left.'
function favouritePorts(request, ports) {
  const codes = getFavouritePortCodes(request)
  return ports.filter((port) => codes.includes(port.code))
}

function portOptions(request, selectedCode, ports) {
  return favouritePorts(request, ports).map(({ code, name }) => ({
    value: code,
    text: name,
    checked: code === selectedCode
  }))
}

function viewContext(request, ports, overrides = {}) {
  return {
    pageTitle,
    heading: pageTitle,
    hintText,
    caption: 'New catch record',
    backLink: {
      href: backForDeparturePort(request),
      text: 'Back'
    },
    addPortHref: '/add-port?for=departure',
    portOptions: portOptions(
      request,
      getJourneyState(request).departurePort,
      ports
    ),
    ...overrides
  }
}

export const departurePortController = {
  async handler(request, h) {
    const ports = await getPortCatalogue()
    migratePortJourneyState(request, ports)
    if (favouritePorts(request, ports).length === 0) {
      return h
        .redirect('/add-port?for=departure&entry=1')
        .code(statusCodes.seeOther)
    }

    return h.view('departure-port/index', viewContext(request, ports))
  }
}

export const departurePortSubmitController = {
  options: {
    validate: {
      payload: Joi.object({
        departurePort: Joi.string().required()
      }),
      async failAction(request, h) {
        const ports = await getPortCatalogue()
        const errorText = pageTitle

        return h
          .view(
            'departure-port/index',
            viewContext(request, ports, {
              errorSummary: {
                titleText: errorSummaryTitle,
                errorList: [{ text: errorText, href: '#departurePort' }]
              },
              fieldErrors: { departurePort: errorText }
            })
          )
          .code(statusCodes.badRequest)
          .takeover()
      }
    }
  },
  async handler(request, h) {
    const ports = await getPortCatalogue()
    const { departurePort } = request.payload
    const port = findPortByCode(departurePort, ports)
    if (!port) {
      const errorText = pageTitle
      return h
        .view(
          'departure-port/index',
          viewContext(request, ports, {
            errorSummary: {
              titleText: errorSummaryTitle,
              errorList: [{ text: errorText, href: '#departurePort' }]
            },
            fieldErrors: { departurePort: errorText }
          })
        )
        .code(statusCodes.badRequest)
    }

    addFavouritePortCode(request, port.code)
    rememberPortName(request, port)
    setJourneyState(request, { departurePort: port.code })

    return h
      .redirect(resolveNextPath(request, '/return-port'))
      .code(statusCodes.seeOther)
  }
}
