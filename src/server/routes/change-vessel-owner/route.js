import { changeVesselOwnerController } from './index.js'

export const changeVesselOwner = {
  plugin: {
    name: 'change-vessel-owner',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/change-vessel-owner',
          ...changeVesselOwnerController
        }
      ])
    }
  }
}
