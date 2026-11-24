import { t } from '#/server/common/helpers/i18n/translator.js'

import Joi from 'joi'

import {
  catchRecordCaption,
  getJourneyState,
  resolveNextPath,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import {
  addFavouritePortCode,
  getFavouritePortCodes,
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

const pageTitle = () => t('catchRecord.selectPort.return.validation.none')
const templatePath = 'return-port/index'
const errorSummaryTitle = () => t('common.errorSummary.title')
const errorText = pageTitle
function favouritePorts(request, ports) {
  const codes = [...getFavouritePortCodes(request)]
  if (liveCatchRecords() && getJourneyState(request).returnPort) {
    codes.push(getJourneyState(request).returnPort)
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
    pageTitle: pageTitle(),
    heading: pageTitle(),
    caption: catchRecordCaption(request),
    addPortHref: portSelectionPath(request, '/add-port?for=return'),
    backLink: {
      href: '/departure-port',
      text: t('header.back')
    },
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
    await loadFavouritePorts(request, ports)
    migratePortJourneyState(request, ports)
    if (getFavouritePortCodes(request).length === 0) {
      return h
        .redirect(portSelectionPath(request, '/add-port?for=return'))
        .code(statusCodes.seeOther)
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
        await loadFavouritePorts(request, ports)
        return h
          .view(
            templatePath,
            viewContext(request, ports, {
              errorSummary: {
                titleText: errorSummaryTitle(),
                errorList: [{ text: errorText(), href: '#returnPort' }]
              },
              fieldErrors: { returnPort: errorText() }
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
    const { returnPort } = request.payload
    const port = findPortByCode(returnPort, ports)
    if (!port) {
      return h
        .view(
          templatePath,
          viewContext(request, ports, {
            errorSummary: {
              titleText: errorSummaryTitle(),
              errorList: [{ text: errorText(), href: '#returnPort' }]
            },
            fieldErrors: { returnPort: errorText() }
          })
        )
        .code(statusCodes.badRequest)
    }

    if (!liveCatchRecords()) {
      addFavouritePortCode(request, port.code)
    }
    rememberPortName(request, port)
    setJourneyState(request, { returnPort: port.code })

    return h
      .redirect(resolveNextPath(request, '/gear-selection'))
      .code(statusCodes.seeOther)
  }
}
