import { mapPortsDataController } from './controller.js'

export const mapPortsData = {
  plugin: {
    name: 'map-ports-data',
    register(server) {
      server.route({
        method: 'GET',
        path: '/map-data/ports',
        ...mapPortsDataController
      })
    }
  }
}
