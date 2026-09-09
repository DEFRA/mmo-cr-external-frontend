import Joi from 'joi'

import { getData } from '#/server/common/data/get-data.js'
import { resolveNextPath } from '#/server/common/helpers/journey/navigation.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

const { id: vesselId, name: vesselName } = getData('selectVessel')
const errorText = 'Select your vessel'

function viewContext(overrides = {}) {
  return {
    pageTitle: 'Select your vessel',
    heading: 'Select your vessel',
    caption: 'New catch record',
    backLink: {
      href: '/draft',
      text: 'Back'
    },
    vesselOptions: [{ value: vesselId, text: vesselName }],
    ...overrides
  }
}

/**
 * A single vessel (OLGA) is available in this placeholder journey, so
 * only one radio item is rendered.
 */
export const selectVesselController = {
  handler(_request, h) {
    return h.view('select-vessel/index', viewContext())
  }
}

export const selectVesselSubmitController = {
  options: {
    validate: {
      payload: Joi.object({
        vesselId: Joi.string().valid(vesselId).required()
      }),
      failAction(request, h) {
        return h
          .view(
            'select-vessel/index',
            viewContext({
              errorSummary: {
                titleText: 'There is a problem',
                errorList: [{ text: errorText, href: '#vesselId' }]
              },
              fieldErrors: { vesselId: errorText }
            })
          )
          .code(statusCodes.badRequest)
          .takeover()
      }
    }
  },
  handler(request, h) {
    return h.redirect(resolveNextPath(request, '/trip-date')).code(303)
  }
}
