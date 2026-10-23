import Joi from 'joi'

import {
  getGearJourneyState as getJourneyState,
  gearPageContext,
  backForStatisticalArea,
  resolveNextPath,
  setGearJourneyState as setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import { getData } from '#/server/common/data/get-data.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import { offlineMapSubrectangleCodes } from '#/server/common/data/offline-map-subrectangle-codes.js'
import { statisticalAreaContent } from '#/server/common/helpers/journey/statistical-area-content.js'
import {
  getPortCatalogue,
  migratePortJourneyState
} from '#/server/common/helpers/ports/ports-list.js'

const nearbyStatisticalAreas = getData('nearbyStatisticalAreas')
const departurePorts = getData('ports')
const validAreaIds = [
  ...new Set([
    ...nearbyStatisticalAreas.map((area) => area.id),
    ...offlineMapSubrectangleCodes,
    'other'
  ])
]

async function viewContext(request, overrides = {}) {
  const journeyState = getJourneyState(request)
  const gearContext = gearPageContext(request)
  const selectedStatisticalArea = journeyState.selectedStatisticalArea
  const departurePort = departurePorts.find(
    (port) => port.code === journeyState.departurePort
  )

  return {
    ...(await statisticalAreaContent(journeyState, {
      gearId: gearContext.gearId
    })),
    ...gearContext,
    caption: 'New catch record',
    backLink: {
      href: backForStatisticalArea(request),
      text: 'Back'
    },
    departurePortName:
      journeyState.portNamesByCode?.[journeyState.departurePort] ||
      departurePort?.name ||
      '',
    departurePortCoordinate:
      journeyState.portCoordinatesByCode?.[journeyState.departurePort] || null,
    selectedStatisticalArea,
    ...overrides
  }
}

export const statisticalAreaController = {
  async handler(request, h) {
    const journeyState = getJourneyState(request)
    if (!journeyState.departurePort) {
      return h.redirect('/departure-port').code(statusCodes.seeOther)
    }

    if (!journeyState.portCoordinatesByCode?.[journeyState.departurePort]) {
      try {
        migratePortJourneyState(request, await getPortCatalogue())
      } catch {
        // Retain the bundled map fallback when reference data is unavailable.
      }
    }

    return h.view('statistical-area/index', await viewContext(request))
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
      async failAction(request, h) {
        const errorText = 'Select the area where most of your catch was caught'

        return h
          .view(
            'statistical-area/index',
            await viewContext(request, {
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
      selectedStatisticalArea: statisticalArea,
      selectedAlternativeAreaOption: null,
      alternativeStatisticalArea: null,
      alternativeStatisticalAreaCoordinates: null
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
