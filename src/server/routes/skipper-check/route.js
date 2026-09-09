import {
  skipperCheckController,
  skipperCheckSubmitController
} from './index.js'

export const skipperCheck = {
  plugin: {
    name: 'skipper-check',
    register(server) {
      server.route([
        { method: 'GET', path: '/skipper-check', ...skipperCheckController },
        {
          method: 'POST',
          path: '/skipper-check',
          ...skipperCheckSubmitController
        }
      ])
    }
  }
}
