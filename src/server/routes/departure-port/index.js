import {
  departurePortController,
  departurePortSubmitController
} from './controller.js'

/**
 * Sets up the routes used in the departure port page.
 * These routes are registered in src/server/plugins/router.js.
 */
export const departurePort = {
  plugin: {
    name: 'departure-port',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/departure-port',
          ...departurePortController
        },
        {
          method: 'POST',
          path: '/departure-port',
          ...departurePortSubmitController
        }
      ])
    }
  }
}
