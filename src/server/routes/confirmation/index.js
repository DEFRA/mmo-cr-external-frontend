import { confirmationController } from './controller.js'

/**
 * Sets up the routes used in the confirmation page.
 * These routes are registered in src/server/plugins/router.js.
 */
export const confirmation = {
  plugin: {
    name: 'confirmation',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/confirmation',
          ...confirmationController
        }
      ])
    }
  }
}
