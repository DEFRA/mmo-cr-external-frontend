import { notImplementedController } from './controller.js'

/**
 * Sets up the routes used in the Empty Page.
 * These routes are registered in src/server/plugins/router.js.
 */
export const notImplemented = {
  plugin: {
    name: 'not-implemented',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/not-implemented',
          ...notImplementedController
        }
      ])
    }
  }
}
