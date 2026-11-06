import { load } from 'cheerio'
import { config } from '#/config/config.js'
import { createServer } from '#/server/server.js'
import { canonicalCatchRecord } from '#/test-helpers/canonical-catch-record.js'
import { getJourneyState } from '#/server/common/helpers/journey/navigation.js'

describe('API-backed catch record listing', () => {
  let server, original, items, fetchMock

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })
  afterAll(async () => server.stop({ timeout: 0 }))

  beforeEach(() => {
    original = config.get('catchRecording')
    config.set('catchRecording', {
      ...original,
      enabled: false,
      serviceUrl: 'https://catch-recording.test',
      token: 'test-token',
      environment: 'test'
    })
    items = [canonicalCatchRecord()]
    fetchMock = vi.fn(async (url) => ({
      status: 200,
      json: async () =>
        url.includes('?')
          ? { items, count: items.length, limit: 100 }
          : items.find((item) => url.endsWith(`/${item.id}`))
    }))
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    config.set('catchRecording', original)
    vi.unstubAllGlobals()
  })

  test.each([false, true])(
    'Should list caller records with journey integration enabled=%s',
    async (enabled) => {
      config.set('catchRecording.enabled', enabled)
      const response = await server.inject('/records')
      expect(response.statusCode).toBe(200)
      const $ = load(response.result)
      expect($('h1').text()).toBe('Your catch records')
      expect($('tbody').text()).toContain('TEST VESSEL')
      expect($('tbody').text()).toContain(items[0].catchRecordReference)
      expect($('tbody').text()).not.toContain('OLGA')
      expect(
        $('th')
          .map((_i, element) => $(element).text())
          .get()
      ).toEqual(['Reference', 'Vessel', 'Trip end date', 'Status'])
      expect(fetchMock).toHaveBeenCalledWith(
        'https://catch-recording.test/v1/catch-records?limit=100',
        expect.objectContaining({ method: 'GET' })
      )
      expect(getJourneyState(response.request)).toEqual({})
    }
  )

  test('Should link drafts to their action page even when journey integration is disabled', async () => {
    const response = await server.inject('/records')
    const $ = load(response.result)
    expect($(`tbody a[href="/draft?recordId=${items[0].id}"]`)).toHaveLength(1)
    expect($('tbody').text()).toContain(items[0].catchRecordReference)
  })

  test.each([false, true])(
    'Should show expanded help and status panels below the records list with empty=%s',
    async (empty) => {
      if (empty) {
        items = []
      }
      const response = await server.inject('/records')
      expect(response.statusCode).toBe(200)
      const $ = load(response.result)
      const panels = $('main details.govuk-details')
      expect(panels).toHaveLength(2)
      expect(
        panels
          .map((_, element) => $(element).find('summary').text().trim())
          .get()
      ).toEqual(['Help with catch recording', 'Catch record statuses'])
      expect(panels.filter('[open]')).toHaveLength(2)
      expect(
        panels.first().closest('.govuk-grid-column-two-thirds')
      ).toHaveLength(1)
      expect(
        panels
          .first()
          .find('h2')
          .map((_, element) => $(element).text())
          .get()
      ).toEqual([
        'What you need to do',
        'When to create your record',
        'Special cases: ICES areas',
        'Get help with your record'
      ])
      expect(panels.first().find('li')).toHaveLength(3)
      expect(panels.first().text()).toContain('0300 020 3788')
      expect(panels.first().text()).toContain('4c, 7d or 7e')
      for (const status of ['Unsent:', 'Submitted:', 'Amended:', 'Late:']) {
        expect(panels.last().text()).toContain(status)
      }
      expect(panels.last().find('a').attr('href')).toBe('/')
      if (empty) {
        expect($('main').text()).toContain('No catch records found.')
      } else {
        expect($('main').html().indexOf('app-records-pagination')).toBeLessThan(
          $('main').html().indexOf('help-with-catch-recording')
        )
      }
    }
  )

  test('Should link to live details when journey integration is enabled', async () => {
    config.set('catchRecording.enabled', true)
    items[0].status = 'SUBMITTED'
    const response = await server.inject('/records')
    expect(
      load(response.result)(`a[href="/records/${items[0].id}"]`)
    ).toHaveLength(2)
  })

  test('Should display Draft in a yellow GOV.UK tag', async () => {
    items[0].displayStatus = 'Draft'
    const response = await server.inject('/records')
    expect(
      load(response.result)('tbody .govuk-tag--yellow').text().trim()
    ).toBe('Draft')
  })

  test('Should show an edited record as Draft even when the backend labels it Amended', async () => {
    items[0].status = 'DRAFT'
    items[0].displayStatus = 'Amended'
    items[0].numberOfSubmissions = 2
    const response = await server.inject('/records')
    expect(response.statusCode).toBe(200)
    expect(
      load(response.result)('tbody .govuk-tag--yellow').text().trim()
    ).toBe('Draft')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test.each([2, 3])(
    'Should derive Amended from saved submission count %s without session state',
    async (count) => {
      items[0].status = 'SUBMITTED'
      items[0].displayStatus = 'Submitted'
      items[0].numberOfSubmissions = count
      const response = await server.inject('/records')
      expect(response.statusCode).toBe(200)
      expect(
        load(response.result)('tbody .govuk-tag--blue').text().trim()
      ).toBe('Amended')
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(fetchMock.mock.calls[1][0]).toBe(
        `https://catch-recording.test/v1/catch-records/${items[0].id}`
      )
    }
  )

  test('Should surface a failed submission-count read rather than mislabel a resubmitted record', async () => {
    items[0].status = 'SUBMITTED'
    fetchMock.mockImplementation(async (url) =>
      url.includes('?')
        ? {
            status: 200,
            json: async () => ({ items, count: items.length, limit: 100 })
          }
        : { status: 503 }
    )
    expect((await server.inject('/records')).statusCode).toBe(503)
  })

  test('Should display Submitted in a light-green GOV.UK tag', async () => {
    items[0].status = 'SUBMITTED'
    items[0].displayStatus = 'Submitted'
    const response = await server.inject('/records')
    const $ = load(response.result)
    expect($('tbody .govuk-tag--green').text().trim()).toBe('Submitted')
  })

  test.each([
    ['Amended', 'blue'],
    ['Late', 'pink'],
    ['Complete', 'grey']
  ])(
    'Should display %s with a %s GOV.UK tag',
    async (displayStatus, colour) => {
      items[0].status = 'SUBMITTED'
      items[0].displayStatus = displayStatus
      items[0].numberOfSubmissions = displayStatus === 'Amended' ? 2 : 1
      if (displayStatus === 'Complete') {
        items[0].status = 'COMPLETE'
      }
      const response = await server.inject('/records')
      expect(response.statusCode).toBe(200)
      const $ = load(response.result)
      expect($(`tbody .govuk-tag--${colour}`).text().trim()).toBe(displayStatus)
      expect($('tbody .app-records-status')).toHaveLength(1)
    }
  )

  test('Should show design pagination with a current-page tile and disabled Next on the last page', async () => {
    const response = await server.inject('/records')
    const $ = load(response.result)
    expect($('.govuk-pagination__item--current').text().trim()).toBe('1')
    expect(
      $('.app-records-pagination__next[aria-disabled="true"]')
    ).toHaveLength(1)
    expect(
      $('.app-records-pagination__next .app-records-pagination__label').text()
    ).toBe('Next')
    expect($('.app-records-pagination__next svg')).toHaveLength(1)
    expect($('a[rel="next"]')).toHaveLength(0)
  })

  test('Should keep query-based status filtering while hiding the filter controls', async () => {
    const response = await server.inject('/records?status=SUBMITTED')
    expect(response.statusCode).toBe(200)
    expect(fetchMock.mock.calls[0][0]).toContain('limit=100&status=SUBMITTED')
    const $ = load(response.result)
    expect($('select[name="status"]')).toHaveLength(0)
    expect($('form[method="get"][action="/records"]')).toHaveLength(0)
  })

  test('Should accept the empty all-status filter', async () => {
    const response = await server.inject('/records?status=')
    expect(response.statusCode).toBe(200)
    expect(fetchMock.mock.calls[0][0]).not.toContain('status=')
  })

  test.each(['status=UNKNOWN', 'page=0', 'page=abc'])(
    'Should reject invalid query %s before calling the API',
    async (query) => {
      expect((await server.inject(`/records?${query}`)).statusCode).toBe(400)
      expect(fetchMock).not.toHaveBeenCalled()
    }
  )

  test('Should paginate only the retrieved set and retain the status filter', async () => {
    items = Array.from({ length: 25 }, (_, index) => ({
      ...canonicalCatchRecord(),
      id: `record-${index}`,
      catchRecordReference: `REFERENCE-${index}`
    }))
    const response = await server.inject('/records?page=2&status=DRAFT')
    expect(response.statusCode).toBe(200)
    const $ = load(response.result)
    expect($('tbody tr')).toHaveLength(10)
    expect($('tbody').text()).toContain('REFERENCE-10')
    expect($('tbody').text()).not.toContain('REFERENCE-20')
    expect($('main').text()).toContain(
      'Showing 11 to 20 of 25 retrieved records'
    )
    expect($('a[rel="next"][href="?page=3&status=DRAFT"]')).toHaveLength(1)
    expect($('.govuk-pagination__item--current').text().trim()).toBe('2')
    expect(fetchMock.mock.calls[0][0]).not.toContain('page=')
  })

  test('Should state the API cap when 100 records are returned', async () => {
    items = Array.from({ length: 100 }, () => canonicalCatchRecord())
    const response = await server.inject('/records')
    expect(response.result).toContain('at most the latest 100 matching records')
  })

  test('Should render an empty state without fixture fallback', async () => {
    items = []
    const response = await server.inject('/records')
    expect(response.statusCode).toBe(200)
    expect(response.result).toContain('No catch records found.')
    expect(load(response.result)('tbody')).toHaveLength(0)
  })

  test('Should display missing trip dates without inventing a value', async () => {
    items[0].trip.dateEnded = null
    const response = await server.inject('/records')
    expect(load(response.result)('tbody').text()).toContain('Not entered')
  })

  test.each([401, 403, 503])(
    'Should surface API errors %s without fixture fallback',
    async (status) => {
      fetchMock.mockResolvedValue({ status })
      const response = await server.inject('/records')
      expect(response.statusCode).toBe(status)
      expect(response.result).not.toContain('OLGA')
    }
  )

  test('Should reject malformed lists', async () => {
    fetchMock.mockResolvedValue({
      status: 200,
      json: async () => ({ items: [] })
    })
    expect((await server.inject('/records')).statusCode).toBe(502)
  })

  test('Should require service configuration even with journey integration disabled', async () => {
    config.set('catchRecording.token', null)
    expect((await server.inject('/records')).statusCode).toBe(503)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('Should retain the create-new action without making a list request', async () => {
    const page = await server.inject('/records')
    expect(
      load(page.result)('form[action="/records/new"][method="post"]')
    ).toHaveLength(1)
    fetchMock.mockClear()
    const response = await server.inject({
      method: 'POST',
      url: '/records/new'
    })
    expect(response.statusCode).toBe(303)
    expect(response.headers.location).toBe('/select-vessel')
    expect(getJourneyState(response.request)).toEqual({})
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
