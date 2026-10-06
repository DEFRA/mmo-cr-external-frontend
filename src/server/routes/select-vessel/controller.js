import Joi from 'joi'

import {
  getJourneyState,
  resolveNextPath,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import {
  getVesselCatalogue,
  getVesselItem
} from '#/server/common/helpers/vessels/vessels-list.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

const errorText = 'Select your vessel'
const templatePath = 'select-vessel/index'

function viewContext(request, vessels, overrides = {}) {
  const selectedId = getJourneyState(request).selectedVesselId
  return {
    pageTitle: errorText,
    heading: errorText,
    caption: 'New catch record',
    backLink: {
      href: '/draft',
      text: 'Back'
    },
    vesselOptions: vessels.map((vessel) => ({
      value: vessel.id,
      text: vessel.displayName || vessel.name,
      checked: vessel.id === selectedId
    })),
    ...overrides
  }
}

export const selectVesselController = {
  async handler(request, h) {
    const vessels = await getVesselCatalogue()
    return h.view(templatePath, viewContext(request, vessels))
  }
}

export const selectVesselSubmitController = {
  options: {
    validate: {
      payload: Joi.object({
        vesselId: Joi.string().required()
      }),
      async failAction(request, h) {
        const vessels = await getVesselCatalogue()
        return h
          .view(
            templatePath,
            viewContext(request, vessels, {
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
  async handler(request, h) {
    const vessels = await getVesselCatalogue()
    const vessel = vessels.find((item) => item.id === request.payload.vesselId)
    if (!vessel) {
      return h
        .view(
          templatePath,
          viewContext(request, vessels, {
            errorSummary: {
              titleText: 'There is a problem',
              errorList: [{ text: errorText, href: '#vesselId' }]
            },
            fieldErrors: { vesselId: errorText }
          })
        )
        .code(statusCodes.badRequest)
    }
    const selectedVessel = await getVesselItem(vessel.id)
    setJourneyState(request, {
      selectedVesselId: selectedVessel.id,
      selectedVesselName: selectedVessel.name,
      selectedVesselLengthOverallMetres: selectedVessel.lengthOverallMetres
    })
    return h
      .redirect(resolveNextPath(request, '/trip-date'))
      .code(statusCodes.seeOther)
  }
}
