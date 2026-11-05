import {
  getJourneyState,
  accountVesselPath
} from '#/server/common/helpers/journey/navigation.js'
import { liveCatchRecords } from '#/server/common/helpers/journey/catch-record-service.js'
import { requireSkipperVessel } from '#/server/common/helpers/journey/vessel-skippers.js'
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
        return h.redirect(accountVesselPath(request, '/add-skipper')).code(303)
      }
    }
    const heading = `Skipper added for vessel ${liveSkippers ? state.selectedVesselName || 'selected vessel' : 'OLGA'}`
    return h.view('skipper-confirmation/index', {
      pageTitle: heading,
      heading,
      backLink: { href: '/account', text: 'Back' },
      skipper: liveSkippers ? state.pendingSkipper : state.skipper || {},
      liveSkippers
    })
  }
}
