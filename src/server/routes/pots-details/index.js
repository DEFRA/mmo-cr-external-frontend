import {
  potsDetailsController,
  potsDetailsSubmitController
} from './controller.js'

/**
 * Sets up the routes used in the pots details page.
 * These routes are registered in src/server/plugins/router.js.
 */
export const potsDetails = {
  plugin: {
    name: 'pots-details',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/pots-details',
          ...potsDetailsController
        },
        {
          method: 'POST',
          path: '/pots-details',
          ...potsDetailsSubmitController
        }
      ])
    }
  }
}
