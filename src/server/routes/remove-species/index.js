import {
  removeSpeciesController,
  removeSpeciesSubmitController
} from './controller.js'

/**
 * Sets up the routes used in the remove species page.
 * These routes are registered in src/server/plugins/router.js.
 */
export const removeSpecies = {
  plugin: {
    name: 'remove-species',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/remove-species',
          ...removeSpeciesController
        },
        {
          method: 'POST',
          path: '/remove-species',
          ...removeSpeciesSubmitController
        }
      ])
    }
  }
}
