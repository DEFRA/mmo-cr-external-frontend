import { createCatchRecordingClient } from './catch-recording.js'

const skipper = {
  id: 'skipper-1',
  name: 'Test Skipper',
  email: 'skipper@example.com',
  phoneNumber: '+44 123456789'
}
const profile = { vesselId: 'vessel-1', skippers: [skipper] }

function setup(body = profile, status = 200) {
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

describe('Vessel skipper API client', () => {
  test.each([
    ['listSkippers', 'GET', ''],
    ['addSkipper', 'POST', ''],
    ['removeSkipper', 'DELETE', '/skipper-1']
  ])(
    'Should call %s without a catch-record version',
    async (method, verb, suffix) => {
      const { client, fetchFn } = setup(
        verb === 'DELETE' ? null : profile,
        verb === 'DELETE' ? 204 : 200
      )
      const { id, ...payload } = skipper
      const result = await client[method]({
        vesselId: 'vessel-1',
        skipperId: id,
        skipper: payload,
        correlationId: 'trace-1',
        idempotencyKey: 'stable-key'
      })
      expect(result).toEqual(verb === 'DELETE' ? null : profile)
      const [url, options] = fetchFn.mock.calls[0]
      expect(url).toBe(
        `https://service.test/catch-recording-service/v1/vessels/vessel-1/skippers${suffix}`
      )
      expect(options.method).toBe(verb)
      expect(options.headers['If-Match']).toBeUndefined()
      expect(options.headers['x-cdp-request-id']).toBe('trace-1')
      expect(options.headers.Authorization).toBeTruthy()
      expect(options.redirect).toBe('error')
      expect(options.signal).toBeInstanceOf(AbortSignal)
      if (verb === 'POST') {
        expect(JSON.parse(options.body)).toEqual(payload)
        expect(options.headers['Idempotency-Key']).toBe('stable-key')
      } else {
        expect(options.body).toBeUndefined()
      }
    }
  )

  test('Should encode vessel and skipper IDs', async () => {
    const { client, fetchFn } = setup(null, 204)
    await client.removeSkipper({ vesselId: 'vessel/1', skipperId: 'skipper?1' })
    expect(fetchFn.mock.calls[0][0]).toContain(
      '/vessels/vessel%2F1/skippers/skipper%3F1'
    )
  })

  test.each([
    { vesselId: 'another-vessel', skippers: [] },
    { vesselId: 'vessel-1' },
    { vesselId: 'vessel-1', skippers: [null] },
    { vesselId: 'vessel-1', skippers: [{ ...skipper, id: '' }] },
    { vesselId: 'vessel-1', skippers: [{ ...skipper, name: '' }] },
    { vesselId: 'vessel-1', skippers: [{ ...skipper, phoneNumber: 123 }] },
    { vesselId: 'vessel-1', skippers: [{ ...skipper, email: {} }] },
    { vesselId: 'vessel-1', skippers: [skipper, skipper] }
  ])('Should reject malformed skipper profiles %j', async (body) => {
    const { client } = setup(body)
    await expect(
      client.listSkippers({ vesselId: 'vessel-1' })
    ).rejects.toMatchObject({ output: { statusCode: 502 } })
  })

  test('Should accept an empty vessel profile', async () => {
    const body = { vesselId: 'vessel-1', skippers: [] }
    const { client } = setup(body)
    await expect(
      client.listSkippers({ vesselId: 'vessel-1' })
    ).resolves.toEqual(body)
  })

  test('Should add a name without optional contact fields', async () => {
    const { client, fetchFn } = setup({
      vesselId: 'vessel-1',
      skippers: [
        { id: 'new-id', name: 'Test Skipper', email: null, phoneNumber: null }
      ]
    })
    await client.addSkipper({
      vesselId: 'vessel-1',
      skipper: { name: ' Test Skipper ' }
    })
    expect(JSON.parse(fetchFn.mock.calls[0][1].body)).toEqual({
      name: 'Test Skipper'
    })
  })

  test.each([
    undefined,
    {},
    { name: '' },
    { name: 'x'.repeat(101) },
    { name: 'Test Skipper', phoneNumber: '1'.repeat(31) },
    { name: 'Test Skipper', email: 'invalid' },
    { name: 'Test Skipper', id: 'client-id' }
  ])(
    'Should reject invalid additions before calling upstream %j',
    async (payload) => {
      const { client, fetchFn } = setup()
      await expect(
        client.addSkipper({ vesselId: 'vessel-1', skipper: payload })
      ).rejects.toMatchObject({ output: { statusCode: 400 } })
      expect(fetchFn).not.toHaveBeenCalled()
    }
  )

  test.each(['listSkippers', 'addSkipper', 'removeSkipper'])(
    'Should require a vessel before %s',
    async (method) => {
      const { client, fetchFn } = setup()
      await expect(
        Promise.resolve().then(() =>
          client[method]({
            skipper: { name: 'Test Skipper' },
            skipperId: 'skipper-1'
          })
        )
      ).rejects.toMatchObject({ output: { statusCode: 400 } })
      expect(fetchFn).not.toHaveBeenCalled()
    }
  )

  test('Should require a skipper ID for deletion', async () => {
    const { client, fetchFn } = setup()
    await expect(
      Promise.resolve().then(() =>
        client.removeSkipper({ vesselId: 'vessel-1' })
      )
    ).rejects.toMatchObject({ output: { statusCode: 400 } })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  test('Should reject a successful add response that omits the skipper', async () => {
    const { client } = setup({ vesselId: 'vessel-1', skippers: [] })
    await expect(
      client.addSkipper({
        vesselId: 'vessel-1',
        skipper: { name: 'Test Skipper' }
      })
    ).rejects.toMatchObject({ output: { statusCode: 502 } })
  })

  test.each([400, 401, 403, 404, 409, 422, 503])(
    'Should surface upstream status %s',
    async (status) => {
      const { client } = setup(null, status)
      await expect(
        client.addSkipper({
          vesselId: 'vessel-1',
          skipper: { name: 'Test Skipper' }
        })
      ).rejects.toMatchObject({ output: { statusCode: status } })
    }
  )

  test.each([
    ['listSkippers', 204],
    ['addSkipper', 201],
    ['removeSkipper', 200]
  ])(
    'Should reject an unexpected success status for %s',
    async (method, status) => {
      const { client } = setup(profile, status)
      await expect(
        client[method]({
          vesselId: 'vessel-1',
          skipper: { name: 'Test Skipper' },
          skipperId: 'skipper-1'
        })
      ).rejects.toMatchObject({ output: { statusCode: 502 } })
    }
  )
})
