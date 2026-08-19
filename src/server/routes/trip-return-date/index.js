import {
  tripReturnDateController,
  tripReturnDateSubmitController
} from './controller.js'

/**
 * Sets up the routes used in the trip return date page.
 * These routes are registered in src/server/plugins/router.js.
 */
export const tripReturnDate = {
  plugin: {
    name: 'trip-return-date',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/trip-return-date',
          ...tripReturnDateController
        },
        {
          method: 'POST',
          path: '/trip-return-date',
          ...tripReturnDateSubmitController
        }
      ])
    }
  }
}
