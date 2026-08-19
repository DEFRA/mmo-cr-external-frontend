import { tripDateController, tripDateSubmitController } from './controller.js'

/**
 * Sets up the routes used in the trip date question page.
 * These routes are registered in src/server/plugins/router.js.
 */
export const tripDate = {
  plugin: {
    name: 'trip-date',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/trip-date',
          ...tripDateController
        },
        {
          method: 'POST',
          path: '/trip-date',
          ...tripDateSubmitController
        }
      ])
    }
  }
}
