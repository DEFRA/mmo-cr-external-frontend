import { createCatchRecordingClient } from './catch-recording.js'

const draft = {
  id: 'draft-id',
  catchRecordReference: 'A1234520261029172000',
  version: 1,
  status: 'DRAFT'
}
const catchRecord = {
  id: 'record/with space',
  status: 'DRAFT',
  displayStatus: 'Draft',
  version: 3,
  completedSections: ['pairFishing'],
  incompleteSections: ['trip', 'gears'],
  sectionCompletion: { trip: false, pairFishing: true, gears: false },
  progress: {
    hasUnsubmittedChanges: true,
    numberOfSubmissions: 0,
    incompleteGearAssociationIds: ['association-1'],
    currentIncompleteGearAssociationId: 'association-1',
    allGearsComplete: false
  },
  submissionEligible: false
}
const input = {
  vesselId: 'vessel-id',
  idempotencyKey: 'creation-key',
  correlationId: 'trace-id'
}

function setup(fetchFn, overrides = {}) {
  return createCatchRecordingClient({
    serviceUrl: 'https://service.test/catch-recording-service/',
    token: 'test-token',
    fetchFn,
    ...overrides
  })
}

describe('Catch Recording draft client', () => {
  test('Should retrieve a record by encoded ID and return only status and progress data', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => catchRecord
    })
    const client = setup(fetchFn)
    const result = await client.getCatchRecord({
      catchRecordId: catchRecord.id,
      correlationId: 'trace-id'
    })

    expect(fetchFn).toHaveBeenCalledWith(
      'https://service.test/catch-recording-service/v1/catch-records/record%2Fwith%20space',
      expect.objectContaining({
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer test-token',
          'x-cdp-request-id': 'trace-id'
        },
        signal: expect.any(AbortSignal),
        redirect: 'error'
      })
    )
    expect(result).toEqual({
      id: catchRecord.id,
      status: catchRecord.status,
      displayStatus: catchRecord.displayStatus,
      version: catchRecord.version,
      completedSections: catchRecord.completedSections,
      incompleteSections: catchRecord.incompleteSections,
      progress: {
        hasUnsubmittedChanges: true,
        numberOfSubmissions: 0,
        incompleteGearAssociationIds: ['association-1'],
        allGearsComplete: false
      },
      submissionEligible: false
    })
    expect(result).not.toHaveProperty('ownerUserId')
  })

  test.each([404, 401, 503])(
    'Should map GET HTTP %s to a safe service error',
    async (status) => {
      const client = setup(vi.fn().mockResolvedValue({ status }))
      await expect(
        client.getCatchRecord({ catchRecordId: 'record-id' })
      ).rejects.toMatchObject({
        message: 'Catch record could not be retrieved',
        output: { statusCode: 503 }
      })
    }
  )

  test.each([
    { ...catchRecord, id: 'another-id' },
    { ...catchRecord, status: 'UNKNOWN' },
    { ...catchRecord, displayStatus: 'Unknown' },
    { ...catchRecord, version: 0 },
    { ...catchRecord, completedSections: ['private'] },
    { ...catchRecord, sectionCompletion: { trip: 1 } },
    {
      ...catchRecord,
      progress: { ...catchRecord.progress, allGearsComplete: 'no' }
    },
    { ...catchRecord, submissionEligible: 'no' }
  ])('Should reject malformed GET response safely: %j', async (body) => {
    const client = setup(
      vi.fn().mockResolvedValue({ status: 200, json: async () => body })
    )
    await expect(
      client.getCatchRecord({ catchRecordId: catchRecord.id })
    ).rejects.toMatchObject({
      message: 'Catch Recording Service returned an invalid record',
      output: { statusCode: 502 }
    })
  })

  test('Should not expose GET network or JSON errors', async () => {
    const network = setup(vi.fn().mockRejectedValue(new Error('private token')))
    await expect(
      network.getCatchRecord({ catchRecordId: 'record-id' })
    ).rejects.toThrow('Catch record could not be retrieved')
    const invalidJson = setup(
      vi.fn().mockResolvedValue({
        status: 200,
        json: async () => {
          throw new SyntaxError('private body')
        }
      })
    )
    await expect(
      invalidJson.getCatchRecord({ catchRecordId: 'record-id' })
    ).rejects.toThrow('Catch record could not be retrieved')
  })

  test('Should preserve the gateway prefix and send only the vessel with authentication, idempotency and tracing', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue({ status: 201, json: async () => draft })
    expect(await setup(fetchFn).createDraft(input)).toEqual({
      id: draft.id,
      catchRecordReference: draft.catchRecordReference,
      version: 1
    })
    expect(fetchFn).toHaveBeenCalledWith(
      'https://service.test/catch-recording-service/v1/catch-records',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ vesselId: input.vesselId }),
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
          'Idempotency-Key': 'creation-key',
          'x-cdp-request-id': 'trace-id'
        },
        signal: expect.any(AbortSignal),
        redirect: 'error'
      })
    )
  })

  test.each(['serviceUrl', 'token'])(
    'Should fail without %s and not call the backend',
    async (key) => {
      const fetchFn = vi.fn()
      await expect(
        setup(fetchFn, { [key]: null }).createDraft(input)
      ).rejects.toMatchObject({
        output: { statusCode: 503 }
      })
      expect(fetchFn).not.toHaveBeenCalled()
    }
  )

  test.each([200, 400, 401, 403, 409, 500, 503])(
    'Should reject HTTP %s without exposing backend details',
    async (status) => {
      const fetchFn = vi.fn().mockResolvedValue({ status })
      await expect(setup(fetchFn).createDraft(input)).rejects.toMatchObject({
        message: 'Catch record could not be created',
        output: { statusCode: 503 }
      })
      expect(fetchFn).toHaveBeenCalledTimes(1)
    }
  )

  test.each([
    null,
    { ...draft, id: '' },
    { ...draft, id: 1 },
    { ...draft, catchRecordReference: '' },
    { ...draft, catchRecordReference: null },
    { ...draft, version: 0 },
    { ...draft, version: 1.5 },
    { ...draft, status: 'SUBMITTED' }
  ])('Should reject an invalid draft response: %j', async (body) => {
    await expect(
      setup(
        vi.fn().mockResolvedValue({
          status: 201,
          json: async () => body
        })
      ).createDraft(input)
    ).rejects.toMatchObject({ output: { statusCode: 502 } })
  })

  test('Should handle invalid JSON safely', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      status: 201,
      json: async () => {
        throw new SyntaxError('private body')
      }
    })
    await expect(setup(fetchFn).createDraft(input)).rejects.toThrow(
      'Catch record could not be created'
    )
  })

  test('Should handle a network failure without leaking its details', async () => {
    await expect(
      setup(
        vi.fn().mockRejectedValue(new Error('private URL and token'))
      ).createDraft(input)
    ).rejects.toThrow('Catch record could not be created')
  })

  test('Should abort a slow request', async () => {
    const fetchFn = vi.fn(
      (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason), {
            once: true
          })
        })
    )
    await expect(
      setup(fetchFn, { timeoutMs: 1 }).createDraft(input)
    ).rejects.toMatchObject({
      output: { statusCode: 503 }
    })
  })

  test('Should omit tracing when no correlation id exists', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue({ status: 201, json: async () => draft })
    await setup(fetchFn).createDraft({ ...input, correlationId: undefined })
    expect(fetchFn.mock.calls[0][1].headers).not.toHaveProperty(
      'x-cdp-request-id'
    )
  })
})
