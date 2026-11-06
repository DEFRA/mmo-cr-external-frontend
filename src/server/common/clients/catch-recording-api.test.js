import { createCatchRecordingClient } from './catch-recording.js'
import { canonicalCatchRecord } from '#/test-helpers/canonical-catch-record.js'

const record = canonicalCatchRecord()
const input = {
  catchRecordId: record.id,
  version: 5,
  correlationId: 'trace-1',
  idempotencyKey: 'key-1'
}

function setup(body = record, status = 200) {
  const fetchFn = vi.fn().mockResolvedValue({
    status,
    json: async () => body,
    arrayBuffer: async () => Buffer.from('%PDF-test')
  })
  return {
    fetchFn,
    client: createCatchRecordingClient({
      serviceUrl: 'https://service.test/',
      token: 'test-token',
      fetchFn
    })
  }
}

describe('Catch Recording complete API client', () => {
  test.each([
    [
      'saveSection',
      'PATCH',
      '',
      { section: 'trip', data: {} },
      { section: 'trip', data: {} }
    ],
    ['replaceRecord', 'PUT', '', { payload: { trip: {} } }, { trip: {} }],
    ['submitRecord', 'POST', '/submission', {}, undefined],
    ['completeRecord', 'POST', '/completion', {}, undefined],
    ['startEdit', 'POST', '/edit-start', {}, undefined]
  ])(
    'Should call %s using the version and idempotency key',
    async (method, verb, suffix, options, payload) => {
      const { client, fetchFn } = setup()
      expect(await client[method]({ ...input, ...options })).toEqual(record)
      expect(fetchFn).toHaveBeenCalledWith(
        `https://service.test/v1/catch-records/${record.id}${suffix}`,
        expect.objectContaining({
          method: verb,
          redirect: 'error',
          signal: expect.any(AbortSignal),
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
            'If-Match': '5',
            'Idempotency-Key': 'key-1',
            'x-cdp-request-id': 'trace-1'
          }),
          ...(payload ? { body: JSON.stringify(payload) } : {})
        })
      )
      if (!payload) {
        expect(fetchFn.mock.calls[0][1].body).toBeUndefined()
      }
    }
  )

  test('Should delete using If-Match and accept a bodyless 204', async () => {
    const { client, fetchFn } = setup(null, 204)
    expect(await client.deleteRecord(input)).toBeNull()
    expect(fetchFn.mock.calls[0][1].method).toBe('DELETE')
    expect(fetchFn.mock.calls[0][1].headers['If-Match']).toBe('5')
  })

  test('Should fetch a complete canonical record', async () => {
    expect(await setup().client.getRecord(input)).toEqual(record)
  })

  test('Should filter the bounded list without inventing pagination', async () => {
    const body = { items: [record], count: 1, limit: 100 }
    const { client, fetchFn } = setup(body)
    expect(await client.listRecords({ status: 'DRAFT' })).toEqual(body)
    expect(fetchFn.mock.calls[0][0]).toBe(
      'https://service.test/v1/catch-records?limit=100&status=DRAFT'
    )
    expect(fetchFn.mock.calls[0][1].headers['If-Match']).toBeUndefined()
  })

  test.each([
    [
      'getHistory',
      '/history?limit=100',
      {
        catchRecordId: record.id,
        events: [{ eventType: 'CREATED', timestamp: '2026-06-01' }]
      }
    ],
    [
      'listSubmissions',
      '/submissions',
      {
        catchRecordId: record.id,
        count: 1,
        submissions: [{ submissionNumber: 1, artifacts: [{ type: 'pdf' }] }]
      }
    ]
  ])('Should retrieve %s', async (method, suffix, body) => {
    const { client, fetchFn } = setup(body)
    expect(await client[method](input)).toEqual(body)
    expect(fetchFn.mock.calls[0][0]).toBe(
      `https://service.test/v1/catch-records/${record.id}${suffix}`
    )
  })

  test('Should download bytes without attempting to parse JSON', async () => {
    const { client, fetchFn } = setup()
    const result = await client.downloadArtifact({
      ...input,
      submissionNumber: 1,
      artifactType: 'pdf'
    })
    expect(result.body).toEqual(Buffer.from('%PDF-test'))
    expect(fetchFn.mock.calls[0][0]).toContain('/submissions/1/pdf')
  })

  test.each([400, 401, 403, 404, 409, 412, 422, 500, 503])(
    'Should surface upstream status %s without retrying',
    async (status) => {
      const { client, fetchFn } = setup({}, status)
      await expect(
        client.saveSection({ ...input, section: 'trip', data: {} })
      ).rejects.toMatchObject({
        output: { statusCode: status >= 500 ? 503 : status }
      })
      expect(fetchFn).toHaveBeenCalledTimes(1)
    }
  )

  test.each(['getRecord', 'listRecords', 'getHistory', 'listSubmissions'])(
    'Should reject malformed %s responses',
    async (method) => {
      await expect(setup({}).client[method](input)).rejects.toMatchObject({
        output: { statusCode: 502 }
      })
    }
  )

  test('Should reject network failures', async () => {
    const { client, fetchFn } = setup()
    fetchFn.mockRejectedValue(new Error('network failure'))
    await expect(client.submitRecord(input)).rejects.toMatchObject({
      output: { statusCode: 503 }
    })
  })

  test('Should require versions before mutations', async () => {
    const { client, fetchFn } = setup()
    await expect(
      client.submitRecord({ catchRecordId: record.id })
    ).rejects.toMatchObject({ output: { statusCode: 400 } })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  test('Should reject incorrect success statuses', async () => {
    await expect(
      setup(record, 204).client.getRecord(input)
    ).rejects.toMatchObject({ output: { statusCode: 502 } })
  })

  test.each([0, 101, 1.5, '20'])(
    'Should reject invalid bounded limits %s before making a call',
    async (limit) => {
      const { client, fetchFn } = setup()
      await expect(client.listRecords({ limit })).rejects.toMatchObject({
        output: { statusCode: 400 }
      })
      await expect(
        client.getHistory({ ...input, limit })
      ).rejects.toMatchObject({ output: { statusCode: 400 } })
      expect(fetchFn).not.toHaveBeenCalled()
    }
  )

  test('Should reject malformed gear associations instead of failing during resume', async () => {
    await expect(
      setup({ ...record, gears: [null] }).client.getRecord(input)
    ).rejects.toMatchObject({ output: { statusCode: 502 } })
  })

  test.each([
    { submissionNumber: 0, artifactType: 'pdf' },
    { submissionNumber: 1001, artifactType: 'json' },
    { submissionNumber: 1, artifactType: '../secret' }
  ])('Should reject invalid artifact parameters', (options) => {
    const { client, fetchFn } = setup()
    expect(() => client.downloadArtifact({ ...input, ...options })).toThrow()
    expect(fetchFn).not.toHaveBeenCalled()
  })
})
