import { getData } from '#/server/common/data/get-data.js'

/**
 * A single vessel (OLGA) is available in this placeholder journey, so
 * Continue is sufficient without a real vessel choice.
 */
export const selectVesselController = {
  handler(_request, h) {
    const { name: vesselName, registration: vesselRegistration } =
      getData('selectVessel')

    return h.view('select-vessel/index', {
      pageTitle: 'Select a vessel',
      heading: 'Select a vessel',
      backLink: {
        href: '/draft',
        text: 'Back'
      },
      vesselName,
      vesselRegistration
    })
  }
}

export const selectVesselSubmitController = {
  handler(_request, h) {
    return h.redirect('/trip-date').code(303)
  }
}
