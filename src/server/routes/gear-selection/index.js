import {
  gearSelectionController,
  gearSelectionSubmitController
} from './controller.js'

/**
 * Sets up the routes used in the gear selection page.
 * These routes are registered in src/server/plugins/router.js.
 */
export const gearSelection = {
  plugin: {
    name: 'gear-selection',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/gear-selection',
          ...gearSelectionController
        },
        {
          method: 'POST',
          path: '/gear-selection',
          ...gearSelectionSubmitController
        }
      ])
    }
  }
}
