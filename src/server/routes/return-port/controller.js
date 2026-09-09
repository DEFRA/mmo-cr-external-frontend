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
import { getData } from '#/server/common/data/get-data.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

const pageTitle = 'Select the port you returned to'
const hintText = 'Select the port name, or the nearest port to where you returned.'
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
      href: '/departure-port',
      text: 'Back'
    },
    addPortHref: '/add-port?for=return',
    portOptions: portOptions(request, getJourneyState(request).returnPort),
    ...overrides
  }
}

export const returnPortController = {
  handler(request, h) {
    if (getFavouritePortCodes(request).length === 0) {
      return h.redirect('/add-port?for=return').code(303)
    }

    return h.view('return-port/index', viewContext(request))
  }
}

export const returnPortSubmitController = {
  options: {
    validate: {
      payload: Joi.object({
        returnPort: Joi.string()
          .valid(...ports.map(({ code }) => code))
          .required()
      }),
      failAction(request, h) {
        const errorText = 'Select the port you returned to'

        return h
          .view(
            'return-port/index',
            viewContext(request, {
              errorSummary: {
                titleText: 'There is a problem',
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
  handler(request, h) {
    const { returnPort } = request.payload

    addFavouritePortCode(request, returnPort)
    setJourneyState(request, { returnPort })

    return h.redirect(resolveNextPath(request, '/gear-selection')).code(303)
  }
}
