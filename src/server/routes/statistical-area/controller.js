import Joi from 'joi'

import { setJourneyState } from '#/server/common/helpers/journey/navigation.js'
import { getData } from '#/server/common/data/get-data.js'

export const statisticalAreaController = {
  handler(_request, h) {
    return h.view('statistical-area/index', {
      pageTitle: 'Statistical area',
      heading: 'Statistical area',
      backLink: {
        href: '/pots-details',
        text: 'Back'
      },
      statisticalAreaOptions: getData('statisticalAreas')
    })
  }
}

export const statisticalAreaSubmitController = {
  options: {
    validate: {
      payload: Joi.object({
        statisticalArea: Joi.string().min(1).required()
      })
    }
  },
  handler(request, h) {
    const { statisticalArea } = request.payload
    const isOther = statisticalArea === 'other'

    setJourneyState(request, {
      statAreaBranch: isOther ? 'other' : 'direct'
    })

    return h
      .redirect(isOther ? '/statistical-area-other' : '/species-selection')
      .code(303)
  }
}
