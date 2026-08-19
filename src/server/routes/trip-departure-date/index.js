import {
  tripDepartureDateController,
  tripDepartureDateSubmitController
} from './controller.js'

/**
 * Sets up the routes used in the trip departure date page.
 * These routes are registered in src/server/plugins/router.js.
 */
export const tripDepartureDate = {
  plugin: {
    name: 'trip-departure-date',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/trip-departure-date',
          ...tripDepartureDateController
        },
        {
          method: 'POST',
          path: '/trip-departure-date',
          ...tripDepartureDateSubmitController
        }
      ])
    }
  }
}
