import Joi from 'joi'

import {
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

const pageTitle = 'Select the port you returned to'
const templatePath = 'return-port/index'
const errorSummaryTitle = 'There is a problem'
const hintText =
  'Select the port name, or the nearest port to where you returned.'
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
      href: '/departure-port',
      text: 'Back'
    },
    addPortHref: '/add-port?for=return',
    portOptions: portOptions(
      request,
      getJourneyState(request).returnPort,
      ports
    ),
    ...overrides
  }
}

export const returnPortController = {
  async handler(request, h) {
    const ports = await getPortCatalogue()
    migratePortJourneyState(request, ports)
    if (favouritePorts(request, ports).length === 0) {
      return h.redirect('/add-port?for=return').code(statusCodes.seeOther)
    }

    return h.view(templatePath, viewContext(request, ports))
  }
}

export const returnPortSubmitController = {
  options: {
    validate: {
      payload: Joi.object({
        returnPort: Joi.string().required()
      }),
      async failAction(request, h) {
        const ports = await getPortCatalogue()
        const errorText = pageTitle

        return h
          .view(
            templatePath,
            viewContext(request, ports, {
              errorSummary: {
                titleText: errorSummaryTitle,
                errorList: [{ text: errorText, href: '#returnPort' }]
              },
              fieldErrors: { returnPort: errorText }
            })
          )
          .code(statusCodes.badRequest)
          .takeover()
      }
    }
  },
  async handler(request, h) {
    const ports = await getPortCatalogue()
    const { returnPort } = request.payload
    const port = findPortByCode(returnPort, ports)
    if (!port) {
      const errorText = pageTitle
      return h
        .view(
          templatePath,
          viewContext(request, ports, {
            errorSummary: {
              titleText: errorSummaryTitle,
              errorList: [{ text: errorText, href: '#returnPort' }]
            },
            fieldErrors: { returnPort: errorText }
          })
        )
        .code(statusCodes.badRequest)
    }

    addFavouritePortCode(request, port.code)
    rememberPortName(request, port)
    setJourneyState(request, { returnPort: port.code })

    return h
      .redirect(resolveNextPath(request, '/gear-selection'))
      .code(statusCodes.seeOther)
  }
}
