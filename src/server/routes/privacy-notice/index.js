import { privacyNoticeController } from './controller.js'

/**
 * Sets up the routes used in the privacy notice page.
 * These routes are registered in src/server/plugins/router.js.
 */
export const privacyNotice = {
  plugin: {
    name: 'privacy-notice',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/privacy-notice',
          ...privacyNoticeController
        }
      ])
    }
  }
}
