import {
  statisticalAreaOtherController,
  statisticalAreaOtherSubmitController
} from './controller.js'

/**
 * Sets up the routes used in the alternative statistical area page.
 * These routes are registered in src/server/plugins/router.js.
 */
export const statisticalAreaOther = {
  plugin: {
    name: 'statistical-area-other',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/statistical-area-other',
          ...statisticalAreaOtherController
        },
        {
          method: 'POST',
          path: '/statistical-area-other',
          ...statisticalAreaOtherSubmitController
        }
      ])
    }
  }
}
