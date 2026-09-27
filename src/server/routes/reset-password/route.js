import {
  resetPasswordController,
  resetPasswordSubmitController
} from './index.js'

export const resetPassword = {
  plugin: {
    name: 'reset-password',
    register(server) {
      server.route([
        { method: 'GET', path: '/reset-password', ...resetPasswordController },
        {
          method: 'POST',
          path: '/reset-password',
          ...resetPasswordSubmitController
        }
      ])
    }
  }
}
