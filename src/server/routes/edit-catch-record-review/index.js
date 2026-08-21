import {
  editCatchRecordReviewController,
  editCatchRecordReviewSubmitController
} from './controller.js'

/**
 * Sets up the routes used in the "Editing catch record" amendment-mode
 * review page. These routes are registered in src/server/plugins/router.js.
 */
export const editCatchRecordReview = {
  plugin: {
    name: 'edit-catch-record-review',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/records/{recordId}/edit-review',
          ...editCatchRecordReviewController
        },
        {
          method: 'POST',
          path: '/records/{recordId}/edit-review',
          ...editCatchRecordReviewSubmitController
        }
      ])
    }
  }
}
