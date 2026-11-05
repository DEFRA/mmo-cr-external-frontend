import { load } from 'cheerio'
import { config } from '#/config/config.js'
import { createServer } from '#/server/server.js'
import { canonicalCatchRecord } from '#/test-helpers/canonical-catch-record.js'
import { getJourneyState } from '#/server/common/helpers/journey/navigation.js'

describe('Saved draft actions', () => {
  let server, original, record, fetchMock, cookie
  beforeAll(async () => {
    server = await createServer()
    server.route({
      method: 'POST',
      path: '/test/draft-state',
      handler(request) {
        request.yar.set('journey', request.payload)
        return { saved: true }
      }
    })
    await server.initialize()
  })
  afterAll(async () => server.stop({ timeout: 0 }))
  beforeEach(() => {
    original = config.get('catchRecording')
    config.set('catchRecording', {
      ...original,
      enabled: false,
      serviceUrl: 'https://service.test',
      token: 'test-token',
      environment: 'test'
    })
    record = canonicalCatchRecord()
    cookie = undefined
    fetchMock = vi.fn(async (_url, options) => ({
      status: options.method === 'DELETE' ? 204 : 200,
      json: async () => record
    }))
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    config.set('catchRecording', original)
    vi.unstubAllGlobals()
  })
  async function call(method, url, payload) {
    const response = await server.inject({
      method,
      url,
      payload,
      headers: cookie ? { cookie } : {}
    })
    if (response.headers['set-cookie']) {
      cookie = response.headers['set-cookie']
        .map((value) => value.split(';')[0])
        .join('; ')
    }
    return response
  }
  const path = () => `/draft?recordId=${record.id}`
  async function open() {
    const response = await call('GET', path())
    expect(response.statusCode).toBe(200)
    return load(response.result)('input[name="actionKey"]').val()
  }

  test.each([false, true])(
    'Should render the design for a saved draft with live journey enabled=%s',
    async (enabled) => {
      config.set('catchRecording.enabled', enabled)
      await call('POST', '/test/draft-state', {
        reference: 'GBR-OTHER-021126-123456'
      })
      const response = await call('GET', path())
      expect(response.statusCode).toBe(200)
      const $ = load(response.result)
      expect($('h1').text()).toContain(
        'What do you want to do with your draft record?'
      )
      expect($('.govuk-caption-l').text().trim()).toBe(
        record.catchRecordReference
      )
      expect(
        $('label')
          .map((_i, item) => $(item).text().trim())
          .get()
      ).toEqual(['Complete catch record', 'Delete catch record'])
      expect($('.govuk-button').text().trim()).toBe('Save and continue')
      expect(
        $('[data-testid="app-page-navigation-back-link"]').attr('href')
      ).toBe('/records')
      expect(fetchMock.mock.calls[0][1].method).toBe('GET')
    }
  )

  test('Should delete the selected backend draft with the displayed version even with journey saving off', async () => {
    const actionKey = await open()
    const response = await call('POST', path(), {
      draftAction: 'delete',
      actionKey
    })
    expect(response.statusCode).toBe(303)
    expect(response.headers.location).toBe('/records')
    expect(fetchMock.mock.calls[1]).toEqual([
      `https://service.test/v1/catch-records/${record.id}`,
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({ 'If-Match': '5' })
      })
    ])
    const replay = await call('POST', path(), {
      draftAction: 'delete',
      actionKey
    })
    expect(replay.statusCode).toBe(400)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test.each([true, false])(
    'Should clear only the matching active journey, matching=%s',
    async (matching) => {
      await call('POST', '/test/draft-state', {
        catchRecordId: matching ? record.id : 'another-record',
        version: 3
      })
      const actionKey = await open()
      const response = await call('POST', path(), {
        draftAction: 'delete',
        actionKey
      })
      expect(response.statusCode).toBe(303)
      expect(getJourneyState(response.request)).toEqual(
        matching ? {} : { catchRecordId: 'another-record', version: 3 }
      )
    }
  )

  test.each([409, 404, 503])(
    'Should preserve the journey and surface DELETE failure %s',
    async (status) => {
      await call('POST', '/test/draft-state', {
        catchRecordId: record.id,
        version: 5
      })
      const actionKey = await open()
      fetchMock.mockResolvedValueOnce({ status })
      const response = await call('POST', path(), {
        draftAction: 'delete',
        actionKey
      })
      expect(response.statusCode).toBe(status)
      expect(response.headers.location).toBeUndefined()
      expect(getJourneyState(response.request)).toEqual({
        catchRecordId: record.id,
        version: 5
      })
      expect(fetchMock).toHaveBeenCalledTimes(2)
    }
  )

  test('Should not delete an amended draft with prior submissions', async () => {
    record.numberOfSubmissions = 1
    const actionKey = await open()
    const response = await call('POST', path(), {
      draftAction: 'delete',
      actionKey
    })
    expect(response.statusCode).toBe(409)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('Should resume saved answers and not create another record', async () => {
    config.set('catchRecording.enabled', true)
    const actionKey = await open()
    const response = await call('POST', path(), {
      draftAction: 'complete',
      actionKey
    })
    expect(response.statusCode).toBe(303)
    expect(response.headers.location).toBe('/trip-date')
    expect(getJourneyState(response.request)).toMatchObject({
      catchRecordId: record.id,
      version: 5,
      selectedGearIds: ['gear-1']
    })
    expect(
      fetchMock.mock.calls.every(([, options]) => options.method === 'GET')
    ).toBe(true)
  })

  test('Should require live journey saving before resuming', async () => {
    const actionKey = await open()
    const response = await call('POST', path(), {
      draftAction: 'complete',
      actionKey
    })
    expect(response.statusCode).toBe(409)
    expect(response.result).toContain('Live journey saving must be enabled')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test.each(['SUBMITTED', 'COMPLETE'])(
    'Should reject non-draft status %s',
    async (status) => {
      record.status = status
      expect((await call('GET', path())).statusCode).toBe(409)
    }
  )

  test('Should reject a changed draft before resume', async () => {
    config.set('catchRecording.enabled', true)
    const actionKey = await open()
    record.version = 6
    const response = await call('POST', path(), {
      draftAction: 'complete',
      actionKey
    })
    expect(response.statusCode).toBe(409)
    expect(getJourneyState(response.request)).toEqual({})
  })

  test('Should redisplay validation errors retaining the action binding', async () => {
    const actionKey = await open()
    const response = await call('POST', path(), { actionKey })
    expect(response.statusCode).toBe(400)
    const $ = load(response.result)
    expect($('.govuk-error-summary').text()).toContain(
      'Select what you want to do with this draft record'
    )
    expect($('input[name="actionKey"]').val()).toBe(actionKey)
    expect($('.govuk-caption-l').text().trim()).toBe(
      record.catchRecordReference
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('Should reject actions without an opened matching record', async () => {
    const response = await call('POST', path(), {
      draftAction: 'delete',
      actionKey: '00000000-0000-4000-8000-000000000001'
    })
    expect(response.statusCode).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
    const actionKey = await open()
    expect(
      (
        await call('POST', '/draft?recordId=another-record', {
          draftAction: 'delete',
          actionKey
        })
      ).statusCode
    ).toBe(400)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('Should redirect an unselected draft page to the records list', async () => {
    const response = await call('GET', '/draft')
    expect(response.statusCode).toBe(303)
    expect(response.headers.location).toBe('/records')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
