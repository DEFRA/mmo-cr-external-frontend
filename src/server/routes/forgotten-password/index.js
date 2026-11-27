import {
  CODE_PATH,
  COMPLETE_PATH,
  NEW_PASSWORD_PATH,
  RESEND_PATH,
  START_PATH,
  forgottenPasswordCodeController,
  forgottenPasswordCodeSubmitController,
  forgottenPasswordCompleteController,
  forgottenPasswordController,
  forgottenPasswordNewPasswordController,
  forgottenPasswordNewPasswordSubmitController,
  forgottenPasswordResendController,
  forgottenPasswordSubmitController
} from './controller.js'

export const forgottenPassword = {
  plugin: {
    name: 'forgotten-password',
    register(server) {
      server.route([
        { method: 'GET', path: START_PATH, ...forgottenPasswordController },
        {
          method: 'POST',
          path: START_PATH,
          ...forgottenPasswordSubmitController
        },
        { method: 'GET', path: CODE_PATH, ...forgottenPasswordCodeController },
        {
          method: 'POST',
          path: CODE_PATH,
          ...forgottenPasswordCodeSubmitController
        },
        {
          method: 'POST',
          path: RESEND_PATH,
          ...forgottenPasswordResendController
        },
        {
          method: 'GET',
          path: NEW_PASSWORD_PATH,
          ...forgottenPasswordNewPasswordController
        },
        {
          method: 'POST',
          path: NEW_PASSWORD_PATH,
          ...forgottenPasswordNewPasswordSubmitController
        },
        {
          method: 'GET',
          path: COMPLETE_PATH,
          ...forgottenPasswordCompleteController
        }
      ])
    }
  }
}
