import { createCatchRecordingClient } from './catch-recording.js'

function setup(body, status = 200) {
  const fetchFn = vi.fn().mockResolvedValue({
    status,
    json: async () => body
  })
  return {
    fetchFn,
    client: createCatchRecordingClient({
      serviceUrl: 'https://service.test/catch-recording-service',
      token: 'test-token',
      fetchFn
    })
  }
}

describe.each([
  ['gears', 'Gear', 'Gears', 'gearId', 'favouriteGearIds'],
  ['species', 'Species', 'Species', 'speciesId', 'favouriteSpeciesIds'],
  ['ports', 'Port', 'Ports', 'portId', 'favouritePortIds']
])(
  'Vessel favourite %s API client',
  (resource, singular, plural, idField, field) => {
    const favourites = { vesselId: 'vessel-1', [field]: ['item-1'] }
    test.each([
      [`listFavourite${plural}`, 'GET', '', undefined],
      [`addFavourite${singular}`, 'POST', '', { [idField]: 'item-1' }],
      [`removeFavourite${singular}`, 'DELETE', '/item-1', undefined]
    ])(
      'Should call %s without a catch record version',
      async (method, verb, suffix, body) => {
        const { client, fetchFn } = setup(
          verb === 'DELETE' ? null : favourites,
          verb === 'DELETE' ? 204 : 200
        )
        const result = await client[method]({
          vesselId: 'vessel-1',
          [idField]: 'item-1',
          correlationId: 'trace-1'
        })
        expect(result).toEqual(verb === 'DELETE' ? null : favourites)
        expect(fetchFn.mock.calls[0][0]).toBe(
          `https://service.test/catch-recording-service/v1/vessels/vessel-1/favourite-${resource}${suffix}`
        )
        const options = fetchFn.mock.calls[0][1]
        expect(options.method).toBe(verb)
        expect(options.headers.Authorization).toBe('Bearer test-token')
        expect(options.headers['x-cdp-request-id']).toBe('trace-1')
        expect(options.headers['If-Match']).toBeUndefined()
        expect(options.body).toBe(body ? JSON.stringify(body) : undefined)
        expect(options.redirect).toBe('error')
        expect(options.signal).toBeInstanceOf(AbortSignal)
      }
    )

    test('Should encode vessel and gear IDs in request paths', async () => {
      const { client, fetchFn } = setup(null, 204)
      await client[`removeFavourite${singular}`]({
        vesselId: 'vessel/1',
        [idField]: 'item?1'
      })
      expect(fetchFn.mock.calls[0][0]).toContain(
        `/vessels/vessel%2F1/favourite-${resource}/item%3F1`
      )
    })

    test.each([
      { vesselId: 'another-vessel', [field]: [] },
      { vesselId: 'vessel-1' },
      { vesselId: 'vessel-1', [field]: [null] },
      { vesselId: 'vessel-1', [field]: [''] },
      { vesselId: 'vessel-1', [field]: ['item-1', 'item-1'] }
    ])('Should reject an invalid favourite list %j', async (body) => {
      const { client } = setup(body)
      await expect(
        client[`listFavourite${plural}`]({ vesselId: 'vessel-1' })
      ).rejects.toMatchObject({
        output: { statusCode: 502 }
      })
    })

    test.each([
      `listFavourite${plural}`,
      `addFavourite${singular}`,
      `removeFavourite${singular}`
    ])('Should reject a missing vessel ID before %s', async (method) => {
      const { client, fetchFn } = setup()
      await expect(
        Promise.resolve().then(() => client[method]({ [idField]: 'item-1' }))
      ).rejects.toMatchObject({
        output: { statusCode: 400 }
      })
      expect(fetchFn).not.toHaveBeenCalled()
    })

    test('Should reject an add response that omits the requested gear', async () => {
      const { client } = setup({ vesselId: 'vessel-1', [field]: [] })
      await expect(
        client[`addFavourite${singular}`]({
          vesselId: 'vessel-1',
          [idField]: 'item-1'
        })
      ).rejects.toMatchObject({
        output: { statusCode: 502 }
      })
    })

    test.each([`addFavourite${singular}`, `removeFavourite${singular}`])(
      'Should reject a missing gear ID before %s',
      async (method) => {
        const { client, fetchFn } = setup()
        await expect(
          Promise.resolve().then(() => client[method]({ vesselId: 'vessel-1' }))
        ).rejects.toMatchObject({
          output: { statusCode: 400 }
        })
        expect(fetchFn).not.toHaveBeenCalled()
      }
    )

    test.each([401, 403, 404, 422, 503])(
      'Should surface upstream status %s without a successful fallback',
      async (status) => {
        const { client } = setup(null, status)
        await expect(
          client[`addFavourite${singular}`]({
            vesselId: 'vessel-1',
            [idField]: 'item-1'
          })
        ).rejects.toMatchObject({
          output: { statusCode: status }
        })
      }
    )
  }
)
