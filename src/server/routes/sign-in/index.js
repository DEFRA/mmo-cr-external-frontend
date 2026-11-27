import {
  authCallbackController,
  signInCodeController,
  signInCodeResendController,
  signInCodeSubmitController,
  signInController,
  signInSubmitController
} from './controller.js'
import { CALLBACK_PATH } from '#/server/common/helpers/auth/entra.js'

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
        },
        {
          method: 'POST',
          path: '/sign-in/code/resend',
          ...signInCodeResendController
        },
        {
          method: 'GET',
          path: CALLBACK_PATH,
          ...authCallbackController
        }
      ])
    }
  }
}
