import { changeAddressController } from './index.js'

export const changeAddress = {
  plugin: {
    name: 'change-address',
    register(server) {
      server.route([
        { method: 'GET', path: '/change-address', ...changeAddressController }
      ])
    }
  }
}
