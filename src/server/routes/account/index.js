import { accountController } from './controller.js'

/**
 * Sets up the routes used in the account page.
 * These routes are registered in src/server/plugins/router.js.
 */
export const account = {
  plugin: {
    name: 'account',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/account',
          ...accountController
        }
      ])
    }
  }
}
