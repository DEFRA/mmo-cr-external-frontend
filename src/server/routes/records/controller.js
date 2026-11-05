import Joi from 'joi'

import { listLiveRecords } from '../live-records/controller.js'
import { getJourneyState } from '#/server/common/helpers/journey/navigation.js'

export const recordsController = {
  options: {
    validate: {
      query: Joi.object({
        page: Joi.number().integer().min(1).optional(),
        status: Joi.string()
          .valid('', 'DRAFT', 'SUBMITTED', 'COMPLETE')
          .optional()
      })
    }
  },
  handler: listLiveRecords
}

export const newRecordController = {
  handler(request, h) {
    const state = getJourneyState(request)
    if (state.departurePort && state.returnPort) {
      request.yar.set(
        'previousTripPort',
        state.departurePort === state.returnPort ? state.departurePort : false
      )
    }
    request.yar.set('journey', {})
    return h.redirect('/select-vessel').code(303)
  }
}
