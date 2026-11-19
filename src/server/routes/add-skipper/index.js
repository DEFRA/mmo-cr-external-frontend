import { t } from '#/server/common/helpers/i18n/translator.js'

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
  pageTitle: t('addSkipper.title', { vesselName: vesselName(request) }),
  heading: t('addSkipper.title', { vesselName: vesselName(request) }),
  backLink: { href: '/account', text: t('header.back') },
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
        const errorText = t('addSkipper.error')
        return h
          .view(
            'add-skipper/index',
            viewContext(request, {
              errorSummary: {
                titleText: t('common.errorSummary.title'),
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
