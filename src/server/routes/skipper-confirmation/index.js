import { getJourneyState } from '#/server/common/helpers/journey/navigation.js'
export const skipperConfirmationController = {
  handler(request, h) {
    const state = getJourneyState(request)
    return h.view('skipper-confirmation/index', {
      pageTitle: 'Skipper added for vessel OLGA',
      heading: 'Skipper added for vessel OLGA',
      backLink: { href: '/account', text: 'Back' },
      skipper: state.skipper || {}
    })
  }
}
