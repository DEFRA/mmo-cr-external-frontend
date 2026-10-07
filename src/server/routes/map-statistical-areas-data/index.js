import {
  mapStatisticalAreasCollectionController,
  mapStatisticalAreaItemController
} from './controller.js'

export const mapStatisticalAreasData = {
  plugin: {
    name: 'map-statistical-areas-data',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/map-data/statistical-areas',
          ...mapStatisticalAreasCollectionController
        },
        {
          method: 'GET',
          path: '/map-data/statistical-areas/{id}',
          ...mapStatisticalAreaItemController
        }
      ])
    }
  }
}
