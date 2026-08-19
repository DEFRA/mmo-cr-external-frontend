import { draftController } from './controller.js'

/**
 * Sets up the routes used in the draft page.
 * These routes are registered in src/server/plugins/router.js.
 */
export const draft = {
  plugin: {
    name: 'draft',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/draft',
          ...draftController
        }
      ])
    }
  }
}
