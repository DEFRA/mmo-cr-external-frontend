import {
  confirmSamePortController,
  confirmSamePortSubmitController
} from './controller.js'

/**
 * Sets up the routes used in the confirm-same-port page.
 * These routes are registered in src/server/plugins/router.js.
 */
export const confirmSamePort = {
  plugin: {
    name: 'confirm-same-port',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/confirm-same-port',
          ...confirmSamePortController
        },
        {
          method: 'POST',
          path: '/confirm-same-port',
          ...confirmSamePortSubmitController
        }
      ])
    }
  }
}
