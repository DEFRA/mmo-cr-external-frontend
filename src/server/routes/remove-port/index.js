import {
  removePortController,
  removePortSubmitController
} from './controller.js'

/**
 * Sets up the routes used in the remove port page.
 * These routes are registered in src/server/plugins/router.js.
 */
export const removePort = {
  plugin: {
    name: 'remove-port',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/remove-port',
          ...removePortController
        },
        {
          method: 'POST',
          path: '/remove-port',
          ...removePortSubmitController
        }
      ])
    }
  }
}
