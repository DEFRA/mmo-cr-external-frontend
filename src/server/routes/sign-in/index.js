import {
  signInCodeController,
  signInCodeSubmitController,
  signInController,
  signInSubmitController
} from './controller.js'

/**
 * Sets up the routes used in the sign in page.
 * These routes are registered in src/server/plugins/router.js.
 */
export const signIn = {
  plugin: {
    name: 'sign-in',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/sign-in',
          ...signInController
        },
        {
          method: 'POST',
          path: '/sign-in',
          ...signInSubmitController
        },
        {
          method: 'GET',
          path: '/sign-in/code',
          ...signInCodeController
        },
        {
          method: 'POST',
          path: '/sign-in/code',
          ...signInCodeSubmitController
        }
      ])
    }
  }
}
