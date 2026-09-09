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
import { getData } from '#/server/common/data/get-data.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

const pageTitle = 'Select the port you left from'
const hintText = 'Select a port name or the nearest port to where you left.'
const ports = getData('ports')

function favouritePorts(request) {
  const codes = getFavouritePortCodes(request)
  return ports.filter((port) => codes.includes(port.code))
}

function portOptions(request, selectedCode) {
  return favouritePorts(request).map(({ code, name }) => ({
    value: code,
    text: name,
    checked: code === selectedCode
  }))
}

function viewContext(request, overrides = {}) {
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
    portOptions: portOptions(request, getJourneyState(request).departurePort),
    ...overrides
  }
}

export const departurePortController = {
  handler(request, h) {
    if (getFavouritePortCodes(request).length === 0) {
      return h.redirect('/add-port?for=departure&entry=1').code(303)
    }

    return h.view('departure-port/index', viewContext(request))
  }
}

export const departurePortSubmitController = {
  options: {
    validate: {
      payload: Joi.object({
        departurePort: Joi.string()
          .valid(...ports.map(({ code }) => code))
          .required()
      }),
      failAction(request, h) {
        const errorText = 'Select the port you left from'

        return h
          .view(
            'departure-port/index',
            viewContext(request, {
              errorSummary: {
                titleText: 'There is a problem',
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
  handler(request, h) {
    const { departurePort } = request.payload

    addFavouritePortCode(request, departurePort)
    setJourneyState(request, { departurePort })

    return h.redirect(resolveNextPath(request, '/return-port')).code(303)
  }
}
