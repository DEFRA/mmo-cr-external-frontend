import { changeContactNumberController } from './index.js'

export const changeContactNumber = {
  plugin: {
    name: 'change-contact-number',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/change-contact-number',
          ...changeContactNumberController
        }
      ])
    }
  }
}
