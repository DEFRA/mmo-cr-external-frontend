import {
  speciesNotLandedController,
  speciesNotLandedSubmitController
} from './controller.js'

/**
 * Sets up the routes used in the species not landed page.
 * These routes are registered in src/server/plugins/router.js.
 */
export const speciesNotLanded = {
  plugin: {
    name: 'species-not-landed',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/species-not-landed',
          ...speciesNotLandedController
        },
        {
          method: 'POST',
          path: '/species-not-landed',
          ...speciesNotLandedSubmitController
        }
      ])
    }
  }
}
