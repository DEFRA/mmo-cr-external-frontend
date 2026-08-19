import Joi from 'joi'

import {
  getJourneyState,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import { getData } from '#/server/common/data/get-data.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

const pageTitle = 'Where was most of your catch caught using pots?'
const nearbyStatisticalAreas = getData('nearbyStatisticalAreas')
const validAreaIds = [...nearbyStatisticalAreas.map((area) => area.id), 'other']

function mapAreaItems(selectedValue) {
  return nearbyStatisticalAreas.map((area) => ({
    ...area,
    selected: area.id === selectedValue
  }))
}

function viewContext(request, overrides = {}) {
  const selectedStatisticalArea = getJourneyState(request).selectedStatisticalArea

  return {
    pageTitle,
    heading: pageTitle,
    caption: 'New catch record',
    bodyText: [
      'The statistical areas nearest to your departure port are shown below. Select the area where most of your catch was caught.',
      "If it is not listed, select 'Other' to enter it."
    ],
    backLink: {
      href: '/gear-selection',
      text: 'Back'
    },
    mapAreas: mapAreaItems(selectedStatisticalArea),
    selectedStatisticalArea,
    ...overrides
  }
}

export const statisticalAreaController = {
  handler(request, h) {
    return h.view('statistical-area/index', viewContext(request))
  }
}

export const statisticalAreaSubmitController = {
  options: {
    validate: {
      payload: Joi.object({
        statisticalArea: Joi.string()
          .valid(...validAreaIds)
          .required()
      }),
      failAction(request, h) {
        const errorText = 'Select the area where most of your catch was caught'

        return h
          .view(
            'statistical-area/index',
            viewContext(request, {
              errorSummary: {
                titleText: 'There is a problem',
                errorList: [{ text: errorText, href: '#statisticalArea' }]
              },
              fieldErrors: { statisticalArea: errorText },
              mapAreas: mapAreaItems(request.payload.statisticalArea),
              selectedStatisticalArea: request.payload.statisticalArea
            })
          )
          .code(statusCodes.badRequest)
          .takeover()
      }
    }
  },
  handler(request, h) {
    const { statisticalArea } = request.payload
    const isOther = statisticalArea === 'other'

    setJourneyState(request, {
      statAreaBranch: isOther ? 'other' : 'direct',
      selectedStatisticalArea: statisticalArea
    })

    return h
      .redirect(isOther ? '/statistical-area-other' : '/species-selection')
      .code(303)
  }
}
