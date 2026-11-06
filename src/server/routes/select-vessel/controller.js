import Joi from 'joi'

import {
  catchRecordCaption,
  getJourneyState,
  resolveNextPath,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import {
  getVesselCatalogue,
  getVesselItem
} from '#/server/common/helpers/vessels/vessels-list.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import { buildNavigation } from '#/config/nunjucks/context/build-navigation.js'
import {
  ensureCatchRecordDraft,
  prepareDraftCreation
} from '#/server/common/helpers/journey/create-draft.js'

const errorText = 'Which vessel did you use?'
const errorSummaryTitle = 'There is a problem'
const templatePath = 'select-vessel/index'

function viewContext(request, vessels, overrides = {}) {
  const selectedId = getJourneyState(request).selectedVesselId
  return {
    pageTitle: errorText,
    heading: errorText,
    reference: catchRecordCaption(request),
    navigation: buildNavigation(request, { showWhenSignedOut: true }),
    backLink: {
      href: '/records',
      text: 'Back'
    },
    vesselOptions: vessels.map((vessel) => ({
      value: vessel.id,
      text: vessel.name,
      checked: vessel.id === selectedId
    })),
    ...overrides
  }
}

export const selectVesselController = {
  async handler(request, h) {
    const vessels = await getVesselCatalogue()
    prepareDraftCreation(request)
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
                titleText: errorSummaryTitle,
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
              titleText: errorSummaryTitle,
              errorList: [{ text: errorText, href: '#vesselId' }]
            },
            fieldErrors: { vesselId: errorText }
          })
        )
        .code(statusCodes.badRequest)
    }
    const selectedVessel = await getVesselItem(vessel.id)
    if (!(await ensureCatchRecordDraft(request, selectedVessel))) {
      const message =
        'You cannot change vessel for this record. Start a new catch record from Your catch records.'
      return h
        .view(
          templatePath,
          viewContext(request, vessels, {
            errorSummary: {
              titleText: errorSummaryTitle,
              errorList: [{ text: message, href: '#vesselId' }]
            },
            fieldErrors: { vesselId: message }
          })
        )
        .code(statusCodes.badRequest)
    }
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
