import {
  removeGearController,
  removeGearSubmitController
} from './controller.js'

/**
 * Sets up the routes used in the remove gear page.
 * These routes are registered in src/server/plugins/router.js.
 */
export const removeGear = {
  plugin: {
    name: 'remove-gear',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/remove-gear',
          ...removeGearController
        },
        {
          method: 'POST',
          path: '/remove-gear',
          ...removeGearSubmitController
        }
      ])
    }
  }
}
