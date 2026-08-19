import Joi from 'joi'

import { getData } from '#/server/common/data/get-data.js'

const { id: vesselId, name: vesselName } = getData('selectVessel')

/**
 * A single vessel (OLGA) is available in this placeholder journey, so
 * only one radio item is rendered.
 */
export const selectVesselController = {
  handler(_request, h) {
    return h.view('select-vessel/index', {
      pageTitle: 'Select your vessel',
      heading: 'Select your vessel',
      caption: 'New catch record',
      backLink: {
        href: '/draft',
        text: 'Back'
      },
      vesselOptions: [{ value: vesselId, text: vesselName }]
    })
  }
}

export const selectVesselSubmitController = {
  options: {
    validate: {
      payload: Joi.object({
        vesselId: Joi.string().valid(vesselId).required()
      })
    }
  },
  handler(_request, h) {
    return h.redirect('/trip-date').code(303)
  }
}
