import { recordsController } from './controller.js'

/**
 * Sets up the routes used in the records page.
 * These routes are registered in src/server/plugins/router.js.
 */
export const records = {
  plugin: {
    name: 'records',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/records',
          ...recordsController
        }
      ])
    }
  }
}
