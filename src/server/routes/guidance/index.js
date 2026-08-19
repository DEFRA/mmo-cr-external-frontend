import { guidanceController } from './controller.js'

/**
 * Sets up the routes used in the guidance page.
 * These routes are registered in src/server/plugins/router.js.
 */
export const guidance = {
  plugin: {
    name: 'guidance',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/',
          ...guidanceController
        }
      ])
    }
  }
}
