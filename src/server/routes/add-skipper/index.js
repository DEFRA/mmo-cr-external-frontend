import Joi from 'joi'
import {
  getJourneyState,
  accountVesselPath,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import { liveCatchRecords } from '#/server/common/helpers/journey/catch-record-service.js'
import { requireSkipperVessel } from '#/server/common/helpers/journey/vessel-skippers.js'

function vesselName(request) {
  return liveCatchRecords()
    ? getJourneyState(request).selectedVesselName || 'this vessel'
    : 'OLGA'
}

const viewContext = (request, overrides = {}) => ({
  pageTitle: `Do you want to add a skipper for ${vesselName(request)}?`,
  heading: `Do you want to add a skipper for ${vesselName(request)}?`,
  backLink: { href: '/account', text: 'Back' },
  checked: getJourneyState(request).wantsToAddSkipper,
  ...overrides
})

export const addSkipperController = {
  handler(request, h) {
    if (liveCatchRecords()) {
      requireSkipperVessel(request)
    }
    return h.view('add-skipper/index', viewContext(request))
  }
}

export const addSkipperSubmitController = {
  options: {
    validate: {
      payload: Joi.object({
        wantsToAddSkipper: Joi.string().valid('yes', 'no').required()
      }),
      failAction(request, h) {
        if (liveCatchRecords()) {
          requireSkipperVessel(request)
        }
        const errorText = 'Select yes if you want to add a skipper'
        return h
          .view(
            'add-skipper/index',
            viewContext(request, {
              errorSummary: {
                titleText: 'There is a problem',
                errorList: [{ text: errorText, href: '#wantsToAddSkipper' }]
              },
              fieldErrors: { wantsToAddSkipper: errorText }
            })
          )
          .code(statusCodes.badRequest)
          .takeover()
      }
    }
  },
  handler(request, h) {
    if (liveCatchRecords()) {
      requireSkipperVessel(request)
    }
    const { wantsToAddSkipper } = request.payload
    setJourneyState(request, {
      wantsToAddSkipper,
      ...(liveCatchRecords() && wantsToAddSkipper === 'yes'
        ? {
            pendingSkipper: null,
            pendingSkipperVesselId: null,
            skipperAdditionKey: null,
            skipperConfirmed: false,
            skipperConfirmedVesselId: null
          }
        : {})
    })
    return h
      .redirect(
        accountVesselPath(
          request,
          wantsToAddSkipper === 'yes' ? '/skipper-details' : '/account'
        )
      )
      .code(statusCodes.seeOther)
  }
}
