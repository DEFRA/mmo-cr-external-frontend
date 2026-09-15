import {
  addGearController,
  addGearSubmitController
} from './controller.js'

/**
 * Sets up the routes used in the add gear page.
 * These routes are registered in src/server/plugins/router.js.
 */
export const addGear = {
  plugin: {
    name: 'add-gear',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/add-gear',
          ...addGearController
        },
        {
          method: 'POST',
          path: '/add-gear',
          ...addGearSubmitController
        }
      ])
    }
  }
}
