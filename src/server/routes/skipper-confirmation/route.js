import { skipperConfirmationController } from './index.js'

export const skipperConfirmation = {
  plugin: {
    name: 'skipper-confirmation',
    register(server) {
      server.route({
        method: 'GET',
        path: '/skipper-confirmation',
        ...skipperConfirmationController
      })
    }
  }
}
