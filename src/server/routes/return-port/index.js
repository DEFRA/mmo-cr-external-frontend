import {
  returnPortController,
  returnPortSubmitController
} from './controller.js'

/**
 * Sets up the routes used in the return port page.
 * These routes are registered in src/server/plugins/router.js.
 */
export const returnPort = {
  plugin: {
    name: 'return-port',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/return-port',
          ...returnPortController
        },
        {
          method: 'POST',
          path: '/return-port',
          ...returnPortSubmitController
        }
      ])
    }
  }
}
