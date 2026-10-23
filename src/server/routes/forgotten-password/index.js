import {
  forgottenPasswordController,
  forgottenPasswordSubmitController,
  forgottenPasswordConfirmationController
} from './controller.js'

export const forgottenPassword = {
  plugin: {
    name: 'forgotten-password',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/forgotten-password',
          ...forgottenPasswordController
        },
        {
          method: 'POST',
          path: '/forgotten-password',
          ...forgottenPasswordSubmitController
        },
        {
          method: 'GET',
          path: '/forgotten-password-confirmation',
          ...forgottenPasswordConfirmationController
        }
      ])
    }
  }
}
