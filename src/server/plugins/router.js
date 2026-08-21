import inert from '@hapi/inert'

import { about } from '../routes/about/index.js'
import { health } from '../routes/health/index.js'
import { guidance } from '../routes/guidance/index.js'
import { privacyNotice } from '../routes/privacy-notice/index.js'
import { signIn } from '../routes/sign-in/index.js'
import { signOut } from '../routes/sign-out/index.js'
import { records } from '../routes/records/index.js'
import { recordDetails } from '../routes/record-details/index.js'
import { draft } from '../routes/draft/index.js'
import { selectVessel } from '../routes/select-vessel/index.js'
import { tripDate } from '../routes/trip-date/index.js'
import { tripDepartureDate } from '../routes/trip-departure-date/index.js'
import { tripReturnDate } from '../routes/trip-return-date/index.js'
import { departurePort } from '../routes/departure-port/index.js'
import { returnPort } from '../routes/return-port/index.js'
import { gearSelection } from '../routes/gear-selection/index.js'
import { statisticalArea } from '../routes/statistical-area/index.js'
import { statisticalAreaOther } from '../routes/statistical-area-other/index.js'
import { speciesSelection } from '../routes/species-selection/index.js'
import { catchNotLanded } from '../routes/catch-not-landed/index.js'
import { checkAnswers } from '../routes/check-answers/index.js'
import { confirmation } from '../routes/confirmation/index.js'
import { account } from '../routes/account/index.js'
import { notImplemented } from '../routes/not-implemented/index.js'
import { serveStaticFiles } from './serve-static-files.js'
import { config } from '#/config/config.js'

export const router = {
  plugin: {
    name: 'router',
    async register(server) {
      await server.register([inert])

      // Health-check route. Used by platform to check if service is running, do not remove!
      await server.register([health])

      // Application specific routes, add your own routes here
      await server.register([
        about,
        guidance,
        privacyNotice,
        signIn,
        signOut,
        records,
        recordDetails,
        draft,
        selectVessel,
        tripDate,
        tripDepartureDate,
        tripReturnDate,
        departurePort,
        returnPort,
        gearSelection,
        statisticalArea,
        statisticalAreaOther,
        speciesSelection,
        catchNotLanded,
        checkAnswers,
        confirmation,
        account,
        notImplemented
      ])

      // Static assets
      if (!config.get('isProduction') && !config.get('isTest')) {
        await (async () => {
          const createViteServer = (await import('vite')).createServer
          const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'custom'
          })

          await server.register({
            plugin: (await import('@defra/hapi-connect')).default,
            options: {
              path: '/public',
              middleware: [vite.middlewares]
            }
          })
        })()
      } else {
        server.register(serveStaticFiles)
      }
    }
  }
}
