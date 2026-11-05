import { liveCatchRecords } from '#/server/common/helpers/journey/catch-record-service.js'
import { getJourneyState } from '#/server/common/helpers/journey/navigation.js'
import {
  loadVesselSkippers,
  removeVesselSkippers
} from '#/server/common/helpers/journey/vessel-skippers.js'
import Boom from '@hapi/boom'
import { statusCodes } from '#/server/common/constants/status-codes.js'

function context(request, overrides = {}) {
  return {
    pageTitle: 'Remove skippers from vessel',
    heading: 'Remove skippers from vessel',
    vesselName: getJourneyState(request).selectedVesselName,
    backLink: { href: '/account', text: 'Back' },
    skipperItems: getJourneyState(request).vesselSkippers.map((skipper) => ({
      value: skipper.id,
      text: skipper.name
    })),
    ...overrides
  }
}

async function load(request) {
  if (!liveCatchRecords()) {
    throw Boom.notFound()
  }
  await loadVesselSkippers(request)
}

export const removeSkipper = {
  plugin: {
    name: 'remove-skipper',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/remove-skipper',
          async handler(request, h) {
            await load(request)
            return h.view('remove-skipper/index', context(request))
          }
        },
        {
          method: 'POST',
          path: '/remove-skipper',
          async handler(request, h) {
            await load(request)
            const raw = request.payload?.skipperIds
            const requested = Array.isArray(raw) ? raw : [raw]
            const knownIds = new Set(
              getJourneyState(request).vesselSkippers.map(
                (skipper) => skipper.id
              )
            )
            const ids = [...new Set(requested.filter((id) => knownIds.has(id)))]
            if (!ids.length) {
              const text = 'Select the skipper you want to remove'
              return h
                .view(
                  'remove-skipper/index',
                  context(request, {
                    fieldErrors: { skipperIds: text },
                    errorSummary: {
                      titleText: 'There is a problem',
                      errorList: [{ text, href: '#skipperIds' }]
                    }
                  })
                )
                .code(statusCodes.badRequest)
            }
            await removeVesselSkippers(request, ids)
            return h.redirect('/account').code(statusCodes.seeOther)
          }
        }
      ])
    }
  }
}
