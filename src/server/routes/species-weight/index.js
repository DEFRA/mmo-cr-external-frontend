import {
  speciesWeightController,
  speciesWeightSubmitController
} from './controller.js'

/**
 * Sets up the routes used in the species weight page.
 * These routes are registered in src/server/plugins/router.js.
 */
export const speciesWeight = {
  plugin: {
    name: 'species-weight',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/species-weight',
          ...speciesWeightController
        },
        {
          method: 'POST',
          path: '/species-weight',
          ...speciesWeightSubmitController
        }
      ])
    }
  }
}
