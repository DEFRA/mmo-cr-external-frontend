import { backForDeparturePort } from '#/server/common/helpers/journey/navigation.js'

export const departurePortController = {
  handler(request, h) {
    return h.view('departure-port/index', {
      pageTitle: 'Departure port',
      heading: 'Departure port',
      backLink: {
        href: backForDeparturePort(request),
        text: 'Back'
      }
    })
  }
}

export const departurePortSubmitController = {
  handler(_request, h) {
    return h.redirect('/return-port').code(303)
  }
}
