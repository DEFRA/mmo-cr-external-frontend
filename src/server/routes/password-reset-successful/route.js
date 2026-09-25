import { passwordResetSuccessfulController } from './index.js'

export const passwordResetSuccessful = {
  plugin: {
    name: 'password-reset-successful',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/password-reset-successful',
          ...passwordResetSuccessfulController
        }
      ])
    }
  }
}
