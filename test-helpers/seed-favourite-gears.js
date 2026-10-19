import { setJourneyState } from '#/server/common/helpers/journey/navigation.js'

export const ALL_GEAR_IDS = [
  'beam-trawl',
  'bottom-otter-trawl',
  'dredge',
  'handlines-pole-lines',
  'miscellaneous-gear-diving',
  'pots',
  'seine-nets',
  'trammel-net',
  'traps'
]

const seedRoute = '/__test/favourite-gears'

export async function seedFavouriteGears(
  server,
  gearIds = ALL_GEAR_IDS,
  cookie
) {
  if (!server.table().some((route) => route.path === seedRoute)) {
    server.route({
      method: 'POST',
      path: seedRoute,
      handler: (request, h) => {
        setJourneyState(request, { favouriteGearIds: request.payload.ids })
        return h.response().code(204)
      }
    })
  }

  const response = await server.inject({
    method: 'POST',
    url: seedRoute,
    payload: { ids: gearIds },
    headers: cookie ? { cookie } : {}
  })

  return response.headers['set-cookie']?.[0].split(';')[0] || cookie
}
