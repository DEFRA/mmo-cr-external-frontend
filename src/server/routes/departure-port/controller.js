import Joi from 'joi'

import {
  backForDeparturePort,
  getJourneyState,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import { getData } from '#/server/common/data/get-data.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

const pageTitle = 'Which port did you leave from?'
const ports = getData('ports')

function portOptions(selectedCode) {
  return ports.map(({ code, name }) => ({
    value: code,
    text: name,
    checked: code === selectedCode
  }))
}

function viewContext(request, overrides = {}) {
  return {
    pageTitle,
    heading: pageTitle,
    caption: 'New catch record',
    backLink: {
      href: backForDeparturePort(request),
      text: 'Back'
    },
    portOptions: portOptions(getJourneyState(request).departurePort),
    ...overrides
  }
}

export const departurePortController = {
  handler(request, h) {
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

    setJourneyState(request, { departurePort })

    return h.redirect('/return-port').code(303)
  }
}
