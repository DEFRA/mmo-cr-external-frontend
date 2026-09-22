import {
  addSpeciesController,
  addSpeciesSubmitController
} from './controller.js'

/**
 * Sets up the routes used in the add species page.
 * These routes are registered in src/server/plugins/router.js.
 */
export const addSpecies = {
  plugin: {
    name: 'add-species',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/add-species',
          ...addSpeciesController
        },
        {
          method: 'POST',
          path: '/add-species',
          ...addSpeciesSubmitController
        }
      ])
    }
  }
}
