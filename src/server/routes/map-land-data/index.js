import { mapLandDataController } from './controller.js'

export const mapLandData = {
  plugin: {
    name: 'map-land-data',
    register(server) {
      server.route({
        method: 'GET',
        path: '/map-data/land',
        ...mapLandDataController
      })
    }
  }
}
