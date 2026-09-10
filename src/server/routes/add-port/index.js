import {
  addPortController,
  addPortSubmitController
} from './controller.js'

/**
 * Sets up the routes used in the add-port (type-to-search a favourite port) page.
 * These routes are registered in src/server/plugins/router.js.
 */
export const addPort = {
  plugin: {
    name: 'add-port',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/add-port',
          ...addPortController
        },
        {
          method: 'POST',
          path: '/add-port',
          ...addPortSubmitController
        }
      ])
    }
  }
}
