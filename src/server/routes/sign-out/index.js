import { signOutController } from './controller.js'

/**
 * Sets up the route used to simulate signing out. POST-only (a state-changing
 * action) so it can't be triggered by a plain cross-site link or image tag.
 * These routes are registered in src/server/plugins/router.js.
 */
export const signOut = {
  plugin: {
    name: 'sign-out',
    register(server) {
      server.route([
        {
          method: 'POST',
          path: '/sign-out',
          ...signOutController
        }
      ])
    }
  }
}
