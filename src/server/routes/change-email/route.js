import { changeEmailController } from './index.js'

export const changeEmail = {
  plugin: {
    name: 'change-email',
    register(server) {
      server.route([
        { method: 'GET', path: '/change-email', ...changeEmailController }
      ])
    }
  }
}
