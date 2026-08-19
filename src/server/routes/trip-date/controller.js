import Joi from 'joi'

import { setJourneyState } from '#/server/common/helpers/journey/navigation.js'

export const tripDateController = {
  handler(_request, h) {
    return h.view('trip-date/index', {
      pageTitle: 'Did you leave and return on the same date?',
      heading: 'Did you leave and return on the same date?',
      backLink: {
        href: '/select-vessel',
        text: 'Back'
      }
    })
  }
}

export const tripDateSubmitController = {
  options: {
    validate: {
      payload: Joi.object({
        tripSameDate: Joi.string().valid('yes', 'no').required()
      })
    }
  },
  handler(request, h) {
    const { tripSameDate } = request.payload

    setJourneyState(request, { tripSameDate: tripSameDate === 'yes' })

    return h
      .redirect(tripSameDate === 'yes' ? '/departure-port' : '/trip-departure-date')
      .code(303)
  }
}
