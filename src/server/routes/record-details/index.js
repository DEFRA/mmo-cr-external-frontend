import { recordDetailsController } from './controller.js'

/**
 * Sets up the routes used in the catch record details page.
 * These routes are registered in src/server/plugins/router.js.
 */
export const recordDetails = {
  plugin: {
    name: 'record-details',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/records/{recordId}',
          ...recordDetailsController
        }
      ])
    }
  }
}
