import { checkAnswersController } from './controller.js'

/**
 * Sets up the routes used in the check your answers page.
 * These routes are registered in src/server/plugins/router.js.
 */
export const checkAnswers = {
  plugin: {
    name: 'check-answers',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/check-answers',
          ...checkAnswersController
        }
      ])
    }
  }
}
