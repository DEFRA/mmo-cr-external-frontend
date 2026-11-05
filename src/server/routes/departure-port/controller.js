import Joi from 'joi'

import {
  catchRecordCaption,
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
  findPortByCode,
  getPortCatalogue,
  migratePortJourneyState,
  rememberPortName
} from '#/server/common/helpers/ports/ports-list.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import { loadFavouritePorts } from '#/server/common/helpers/journey/session-favourites.js'
import { liveCatchRecords } from '#/server/common/helpers/journey/catch-record-service.js'

const pageTitle = 'Select the port you set off from'
const templatePath = 'departure-port/index'
const errorSummaryTitle = 'There is a problem'
function favouritePorts(request, ports) {
  const codes = [...getFavouritePortCodes(request)]
  if (liveCatchRecords() && getJourneyState(request).departurePort) {
    codes.push(getJourneyState(request).departurePort)
  }
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
    caption: catchRecordCaption(request),
    backLink: {
      href: backForDeparturePort(request),
      text: 'Back'
    },
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
    await loadFavouritePorts(request, ports)
    migratePortJourneyState(request, ports)
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
    if (getFavouritePortCodes(request).length === 0) {
      return h
        .redirect(portSelectionPath(request, '/add-port?for=departure&entry=1'))
        .code(statusCodes.seeOther)
    }

    return h.view(templatePath, viewContext(request, ports))
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
        await loadFavouritePorts(request, ports)
        const errorText = pageTitle

        return h
          .view(
            templatePath,
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
    await loadFavouritePorts(request, ports)
    const { departurePort } = request.payload
    const port = findPortByCode(departurePort, ports)
    if (!port) {
      const errorText = pageTitle
      return h
        .view(
          templatePath,
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

    if (!liveCatchRecords()) {
      addFavouritePortCode(request, port.code)
    }
    rememberPortName(request, port)
    setJourneyState(request, {
      departurePort: port.code,
      portSelectionStarted: true
    })

    return h
      .redirect(resolveNextPath(request, '/return-port'))
      .code(statusCodes.seeOther)
  }
}
