import {
  selectVesselController,
  selectVesselSubmitController
} from './controller.js'

/**
 * Sets up the routes used in the select vessel page.
 * These routes are registered in src/server/plugins/router.js.
 */
export const selectVessel = {
  plugin: {
    name: 'select-vessel',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/select-vessel',
          ...selectVesselController
        },
        {
          method: 'POST',
          path: '/select-vessel',
          ...selectVesselSubmitController
        }
      ])
    }
  }
}
