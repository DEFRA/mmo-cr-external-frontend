import Joi from 'joi'

import {
  getJourneyState,
  resolveNextPath,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import { getData } from '#/server/common/data/get-data.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import { offlineMapSubrectangleCodes } from '#/server/common/data/offline-map-subrectangle-codes.js'

const pageTitle = 'Where was most of your catch caught using pots?'
const nearbyStatisticalAreas = getData('nearbyStatisticalAreas')
const departurePorts = getData('ports')
const validAreaIds = [...new Set([...nearbyStatisticalAreas.map((area) => area.id), ...offlineMapSubrectangleCodes, 'other'])]

function viewContext(request, overrides = {}) {
  const journeyState = getJourneyState(request)
  const selectedStatisticalArea = journeyState.selectedStatisticalArea
  const departurePort = departurePorts.find(
    (port) => port.code === journeyState.departurePort
  )

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
    departurePortName: departurePort?.name || 'Hastings',
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
      .redirect(
        resolveNextPath(
          request,
          isOther ? '/statistical-area-other' : '/species-selection'
        )
      )
      .code(303)
  }
}
