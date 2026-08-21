import {
  catchNotLandedController,
  catchNotLandedSubmitController
} from './controller.js'

/**
 * Sets up the routes used in the catch not landed page.
 * These routes are registered in src/server/plugins/router.js.
 */
export const catchNotLanded = {
  plugin: {
    name: 'catch-not-landed',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/catch-not-landed',
          ...catchNotLandedController
        },
        {
          method: 'POST',
          path: '/catch-not-landed',
          ...catchNotLandedSubmitController
        }
      ])
    }
  }
}
