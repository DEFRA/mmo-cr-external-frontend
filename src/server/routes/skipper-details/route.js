import {
  skipperDetailsController,
  skipperDetailsSubmitController
} from './index.js'

export const skipperDetails = {
  plugin: {
    name: 'skipper-details',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/skipper-details',
          ...skipperDetailsController
        },
        {
          method: 'POST',
          path: '/skipper-details',
          ...skipperDetailsSubmitController
        }
      ])
    }
  }
}
