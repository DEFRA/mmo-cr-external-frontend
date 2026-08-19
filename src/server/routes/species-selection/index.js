import {
  speciesSelectionController,
  speciesSelectionSubmitController
} from './controller.js'

/**
 * Sets up the routes used in the species selection page.
 * These routes are registered in src/server/plugins/router.js.
 */
export const speciesSelection = {
  plugin: {
    name: 'species-selection',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/species-selection',
          ...speciesSelectionController
        },
        {
          method: 'POST',
          path: '/species-selection',
          ...speciesSelectionSubmitController
        }
      ])
    }
  }
}
