import { t } from '#/server/common/helpers/i18n/translator.js'

import {
  getJourneyState,
  accountVesselPath
} from '#/server/common/helpers/journey/navigation.js'
import { liveCatchRecords } from '#/server/common/helpers/journey/catch-record-service.js'
import { requireSkipperVessel } from '#/server/common/helpers/journey/vessel-skippers.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
export const skipperConfirmationController = {
  handler(request, h) {
    const state = getJourneyState(request)
    const liveSkippers = liveCatchRecords()
    if (liveSkippers) {
      const vesselId = requireSkipperVessel(request)
      if (
        !state.skipperConfirmed ||
        state.skipperConfirmedVesselId !== vesselId
      ) {
        return h
          .redirect(accountVesselPath(request, '/add-skipper'))
          .code(statusCodes.seeOther)
      }
    }
    const heading = t('skipperConfirmation.titleForVessel', {
      vesselName: liveSkippers
        ? state.selectedVesselName || 'selected vessel'
        : 'OLGA'
    })
    return h.view('skipper-confirmation/index', {
      pageTitle: heading,
      heading,
      backLink: { href: '/account', text: t('header.back') },
      skipper: liveSkippers ? state.pendingSkipper : state.skipper || {},
      liveSkippers
    })
  }
}
