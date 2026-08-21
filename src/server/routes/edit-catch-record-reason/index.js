import {
  editCatchRecordReasonController,
  editCatchRecordReasonSubmitController
} from './controller.js'

/**
 * Sets up the routes used in the "Why are you editing this catch record?" page.
 * These routes are registered in src/server/plugins/router.js.
 */
export const editCatchRecordReason = {
  plugin: {
    name: 'edit-catch-record-reason',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/records/{recordId}/edit-reason',
          ...editCatchRecordReasonController
        },
        {
          method: 'POST',
          path: '/records/{recordId}/edit-reason',
          ...editCatchRecordReasonSubmitController
        }
      ])
    }
  }
}
