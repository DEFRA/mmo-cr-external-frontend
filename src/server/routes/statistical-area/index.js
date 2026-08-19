import {
  statisticalAreaController,
  statisticalAreaSubmitController
} from './controller.js'

/**
 * Sets up the routes used in the statistical area page.
 * These routes are registered in src/server/plugins/router.js.
 */
export const statisticalArea = {
  plugin: {
    name: 'statistical-area',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/statistical-area',
          ...statisticalAreaController
        },
        {
          method: 'POST',
          path: '/statistical-area',
          ...statisticalAreaSubmitController
        }
      ])
    }
  }
}
