import Joi from 'joi'

import {
  getJourneyState,
  resolveNextPath,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import { getData } from '#/server/common/data/get-data.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

const pageTitle = 'Which port did you return to?'
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
      href: '/departure-port',
      text: 'Back'
    },
    portOptions: portOptions(getJourneyState(request).returnPort),
    ...overrides
  }
}

export const returnPortController = {
  handler(request, h) {
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

    setJourneyState(request, { returnPort })

    return h.redirect(resolveNextPath(request, '/gear-selection')).code(303)
  }
}
