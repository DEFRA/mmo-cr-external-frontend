import { addSkipperController, addSkipperSubmitController } from './index.js'

export const addSkipper = {
  plugin: {
    name: 'add-skipper',
    register(server) {
      server.route([
        { method: 'GET', path: '/add-skipper', ...addSkipperController },
        { method: 'POST', path: '/add-skipper', ...addSkipperSubmitController }
      ])
    }
  }
}
