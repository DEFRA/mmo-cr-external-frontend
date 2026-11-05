import { load } from 'cheerio'
import { config } from '#/config/config.js'
import { createServer } from '#/server/server.js'
import { getJourneyState } from '#/server/common/helpers/journey/navigation.js'
import { canonicalCatchRecord } from '#/test-helpers/canonical-catch-record.js'
import { recordJourney } from '#/server/common/helpers/journey/catch-record-mapping.js'

vi.mock('#/server/common/helpers/vessels/vessels-list.js', () => ({
  getVesselCatalogue: async () => [
    { id: 'vessel-1', name: 'TEST VESSEL', lengthOverallMetres: 8 },
    { id: 'vessel-2', name: 'SECOND VESSEL', lengthOverallMetres: 9 }
  ],
  getVesselItem: async (id) => ({
    id,
    name: id === 'vessel-2' ? 'SECOND VESSEL' : 'TEST VESSEL',
    lengthOverallMetres: id === 'vessel-2' ? 9 : 8
  })
}))

vi.mock(
  '#/server/common/helpers/ports/ports-list.js',
  async (importOriginal) => ({
    ...(await importOriginal()),
    getPortItem: async (id) => ({
      id,
      code: id === 'port-1' ? 'GBABC' : 'GBDEF',
      name: id === 'port-1' ? 'Test port' : 'Second port'
    }),
    getPortCatalogue: async () => [
      { id: 'port-1', code: 'GBABC', name: 'Test port' },
      { id: 'port-2', code: 'GBDEF', name: 'Second port' }
    ]
  })
)
vi.mock(
  '#/server/common/helpers/gear/favourite-gear.js',
  async (importOriginal) => ({
    ...(await importOriginal()),
    getGearCatalogue: async () => [
      {
        id: 'gear-1',
        label: 'Test gear',
        name: 'Test gear',
        measurements: [{ id: 'measurement-1', label: 'Length' }]
      },
      {
        id: 'gear-2',
        label: 'Recreational gear',
        name: 'Recreational gear',
        measurements: []
      }
    ],
    getGearItem: async () => ({
      id: 'gear-1',
      label: 'Test gear',
      name: 'Test gear',
      measurements: [{ id: 'measurement-1', label: 'Length' }]
    })
  })
)
vi.mock('#/server/common/clients/species-reference-data.js', () => ({
  createSpeciesReferenceDataClient: () => ({
    getSpeciesCatalogue: async () => [
      { id: 'species-1', code: 'COD', name: 'Cod', text: 'Cod' },
      { id: 'species-2', code: 'HAD', name: 'Haddock', text: 'Haddock' }
    ]
  })
}))

describe('Live catch records and section persistence', () => {
  let server, original, record, cookie, fetchMock, originalReferenceToken
  let vesselSkippers
  let vesselFavourites

  beforeAll(async () => {
    server = await createServer()
    server.route({
      method: 'POST',
      path: '/test/user-favourites',
      handler(request) {
        const vesselId = getJourneyState(request).selectedVesselId || 'vessel-1'
        vesselFavourites[vesselId] = request.payload
        request.yar.set('vesselFavourites', {
          ...request.yar.get('vesselFavourites'),
          [vesselId]: request.payload
        })
        return { saved: true }
      }
    })
    server.route({
      method: 'POST',
      path: '/test/amendment',
      handler(request) {
        request.yar.set('amendment', request.payload)
        return { saved: true }
      }
    })
    server.route({
      method: 'POST',
      path: '/test/live-journey',
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
    originalReferenceToken = config.get('referenceData.token')
    config.set('referenceData.token', 'test-reference-token')
    config.set('catchRecording', {
      ...original,
      enabled: true,
      serviceUrl: 'https://catch-recording.test',
      token: 'test-token',
      environment: 'test'
    })
    cookie = undefined
    record = canonicalCatchRecord()
    vesselSkippers = {}
    vesselFavourites = {}
    fetchMock = vi.fn(async (url, options) => {
      const { pathname } = new URL(url)
      const body = (() => {
        const favouritePath = pathname.match(
          /^\/v1\/vessels\/([^/]+)\/favourite-(gears|species|ports)(?:\/([^/]+))?$/
        )
        if (favouritePath) {
          const [, vesselId, resource, itemId] = favouritePath
          const [field, idField] = {
            gears: ['favouriteGearIds', 'gearId'],
            species: ['favouriteSpeciesIds', 'speciesId'],
            ports: ['favouritePortIds', 'portId']
          }[resource]
          const preferences = (vesselFavourites[vesselId] ||= {})
          const ids = preferences[field] || []
          if (options.method === 'POST') {
            const id = JSON.parse(options.body)[idField]
            preferences[field] = [...new Set([...ids, id])]
          } else if (options.method === 'DELETE') {
            preferences[field] = ids.filter((id) => id !== itemId)
          }
          return { vesselId, [field]: preferences[field] || [] }
        }
        const skipperPath = pathname.match(
          /^\/v1\/vessels\/([^/]+)\/skippers(?:\/([^/]+))?$/
        )
        if (skipperPath) {
          const [, vesselId, skipperId] = skipperPath
          const skippers = vesselSkippers[vesselId] || []
          if (options.method === 'POST') {
            const payload = JSON.parse(options.body)
            vesselSkippers[vesselId] = skippers.some(
              (item) => item.name.toLowerCase() === payload.name.toLowerCase()
            )
              ? skippers
              : [
                  ...skippers,
                  { id: `skipper-${skippers.length + 1}`, ...payload }
                ]
          } else if (options.method === 'DELETE') {
            vesselSkippers[vesselId] = skippers.filter(
              (item) => item.id !== skipperId
            )
          }
          return { vesselId, skippers: vesselSkippers[vesselId] || [] }
        }
        if (pathname === '/api/v1/reference-data/map/statistical-areas') {
          return {
            type: 'FeatureCollection',
            metadata: { dataset: 'map-statistical-areas' },
            features: [
              {
                type: 'Feature',
                id: 'area-1',
                properties: {
                  code: new URL(url).searchParams.get('query') || '30E5'
                },
                geometry: { type: 'Polygon', coordinates: [] }
              }
            ]
          }
        }
        if (pathname === '/v1/catch-records') {
          if (options.method === 'POST') return record
          return { items: [record], count: 1, limit: 100 }
        }
        if (pathname.endsWith('/history')) {
          return {
            catchRecordId: record.id,
            displayStatus: 'Draft',
            events: [
              { eventType: 'CREATED', timestamp: '2026-06-01T10:00:00Z' }
            ]
          }
        }
        if (pathname.endsWith('/submissions')) {
          return {
            catchRecordId: record.id,
            count: 1,
            submissions: [
              {
                submissionNumber: 1,
                artifacts: [{ type: 'pdf' }, { type: 'json' }]
              }
            ]
          }
        }
        if (pathname.endsWith('/submission')) {
          record = {
            ...record,
            status: 'SUBMITTED',
            displayStatus: 'Submitted',
            numberOfSubmissions: record.numberOfSubmissions + 1,
            version: record.version + 1
          }
          return record
        }
        if (pathname.endsWith('/completion')) {
          record = {
            ...record,
            status: 'COMPLETE',
            displayStatus: 'Complete',
            version: record.version + 1
          }
          return record
        }
        if (options.method === 'PUT') {
          const payload = JSON.parse(options.body)
          record = {
            ...record,
            ...payload,
            vessel: { ...record.vessel, ...payload.vessel },
            gears: payload.gears.map((entry) => ({
              ...entry,
              gear: {
                ...record.gears.find(
                  (previous) => previous.gear.id === entry.gear.id
                )?.gear,
                ...entry.gear
              }
            })),
            version: record.version + 1
          }
          return record
        }
        if (options.method === 'PATCH') {
          const { section, data } = JSON.parse(options.body)
          if (section === 'trip') {
            if (
              !data.departurePort?.id ||
              !data.returnPort?.id ||
              (data.startedAndFinishedToday === false &&
                (!data.dateStarted || !data.dateEnded))
            ) {
              throw new Error('Trip section must be complete before PATCH')
            }
            record.trip = data
          }
          if (section === 'speciesNotLanded') record.speciesNotLanded = data
          if (section === 'gears') {
            record.gears = data.map((entry) => {
              const previous = record.gears.find(
                (item) => item.gear.id === entry.gear.id
              )
              if (
                entry.associationId &&
                !record.gears.some(
                  (item) => item.associationId === entry.associationId
                )
              ) {
                throw new Error(
                  'New gear association identities must be generated by the backend'
                )
              }
              return {
                ...previous,
                ...entry,
                associationId:
                  entry.associationId || '00000000-0000-4000-8000-000000000222',
                gear: {
                  nameSnapshot: 'Test gear',
                  ...previous?.gear,
                  ...entry.gear
                }
              }
            })
          }
          record = { ...record, version: record.version + 1 }
          return record
        }
        if (pathname.endsWith('/edit-start')) {
          record = {
            ...record,
            status: 'DRAFT',
            displayStatus: 'Draft',
            version: record.version + 1
          }
          return record
        }
        if (
          pathname === `/v1/catch-records/${record.id}` ||
          /\/submissions\/1\/(pdf|json)$/.test(pathname)
        ) {
          return record
        }
        throw new Error(`Unexpected request: ${options.method} ${pathname}`)
      })()
      return {
        ok: true,
        status:
          options.method === 'DELETE'
            ? 204
            : pathname === '/v1/catch-records' && options.method === 'POST'
              ? 201
              : 200,
        json: async () => body,
        arrayBuffer: async () => Buffer.from('%PDF-test')
      }
    })
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    config.set('catchRecording', original)
    config.set('referenceData.token', originalReferenceToken)
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
  async function seed(state = recordJourney(record)) {
    return call('POST', '/test/live-journey', state)
  }
  async function seedFavourites(state) {
    return call('POST', '/test/user-favourites', state)
  }
  async function openRecord() {
    const response = await call('GET', `/records/${record.id}`)
    expect(response.statusCode).toBe(200)
    return response.request.yar.get('recordAction').key
  }

  test('Should repeat named vessel blocks on account and keep all four backend profiles isolated', async () => {
    await seed()
    const trip = structuredClone(
      getJourneyState((await call('GET', '/trip-date')).request)
    )
    await call('POST', '/sign-in')
    const account = await call('GET', '/account')
    expect(account.statusCode).toBe(200)
    let $ = load(account.result)
    expect(
      $('main h3')
        .map((_, item) => $(item).text())
        .get()
    ).toEqual(['TEST VESSEL', 'SECOND VESSEL'])
    expect(
      $('main h2')
        .map((_, item) => $(item).text())
        .get()
    ).toEqual(['Personal details', 'Vessel details'])
    for (const id of ['vessel-1', 'vessel-2']) {
      expect(
        $(`a[href="/add-gear?return=/account&vesselId=${id}"]`)
      ).toHaveLength(1)
      expect($(`a[href="/add-skipper?vesselId=${id}"]`)).toHaveLength(1)
      expect($(`a[href="/remove-port?vesselId=${id}"]`)).toHaveLength(1)
    }
    const actions = [
      [
        '/add-port?for=departure&return=/account&vesselId=vessel-1',
        { port: 'Test port' }
      ],
      [
        '/add-gear?return=/account&vesselId=vessel-1',
        { gear: 'Recreational gear' }
      ],
      ['/add-species?return=/account&vesselId=vessel-1', { species: 'Cod' }],
      [
        '/add-port?for=departure&return=/account&vesselId=vessel-2',
        { port: 'Second port' }
      ],
      ['/add-species?return=/account&vesselId=vessel-2', { species: 'Haddock' }]
    ]
    for (const [path, payload] of actions) {
      const saved = await call('POST', path, payload)
      expect(saved.statusCode, saved.result).toBe(303)
      expect(saved.headers.location).toBe('/account')
    }
    const gearPath = '/add-gear?return=/account&vesselId=vessel-2'
    const gearPage = await call('GET', gearPath)
    expect(gearPage.statusCode).toBe(200)
    const gear = await call('POST', gearPath, { gear: 'Test gear' })
    expect(gear.headers.location).toContain('vesselId=vessel-2')
    const invalid = await call('POST', gear.headers.location, {
      'measurement-1': '-1'
    })
    expect(invalid.statusCode).toBe(400)
    const measured = await call('POST', gear.headers.location, {
      'measurement-1': '12'
    })
    expect(measured.statusCode).toBe(303)
    const skipper = await call('POST', '/add-skipper?vesselId=vessel-2', {
      wantsToAddSkipper: 'yes'
    })
    expect(skipper.headers.location).toBe('/skipper-details?vesselId=vessel-2')
    const details = await call('POST', skipper.headers.location, {
      firstName: 'Second',
      lastName: 'Skipper'
    })
    expect(details.headers.location).toBe('/skipper-check?vesselId=vessel-2')
    const check = await call('GET', details.headers.location)
    expect(
      load(check.result)(
        'a[href="/skipper-details?vesselId=vessel-2#firstName"]'
      )
    ).toHaveLength(1)
    const confirmed = await call('POST', details.headers.location, {
      confirmSkipper: 'true'
    })
    expect(confirmed.headers.location).toBe(
      '/skipper-confirmation?vesselId=vessel-2'
    )
    expect((await call('GET', confirmed.headers.location)).statusCode).toBe(200)
    const refreshed = await call('GET', '/account')
    $ = load(refreshed.result)
    const lists = $('main .app-account-summary-list')
    expect(lists.eq(1).text()).toContain('Test port')
    expect(lists.eq(1).text()).not.toContain('Second port')
    expect(lists.eq(1).text()).toContain('Recreational gear')
    expect(lists.eq(1).text()).not.toContain('Haddock')
    expect(lists.eq(2).text()).toContain('Second port')
    expect(lists.eq(2).text()).toContain('Test gear')
    expect(lists.eq(2).text()).toContain('Haddock')
    expect(lists.eq(2).text()).toContain('Second Skipper')
    expect(lists.eq(1).text()).not.toContain('Second Skipper')
    expect(refreshed.request.yar.get('journey')).toMatchObject({
      catchRecordId: trip.catchRecordId,
      selectedVesselId: trip.selectedVesselId,
      selectedGearIds: trip.selectedGearIds
    })
    for (const [path, payload] of [
      ['/remove-port?vesselId=vessel-1', { ports: 'port-1' }],
      ['/remove-gear?return=/account&vesselId=vessel-1', { gearIds: 'gear-2' }],
      [
        '/remove-species?return=/account&vesselId=vessel-1',
        { speciesIds: 'species-1' }
      ]
    ]) {
      const removed = await call('POST', path, payload)
      expect(removed.statusCode, removed.result).toBe(303)
    }
    expect(vesselFavourites['vessel-1']).toMatchObject({
      favouritePortIds: [],
      favouriteGearIds: [],
      favouriteSpeciesIds: []
    })
    expect(vesselFavourites['vessel-2']).toMatchObject({
      favouritePortIds: ['port-2'],
      favouriteGearIds: ['gear-1'],
      favouriteSpeciesIds: ['species-2']
    })
    cookie = undefined
    await call('POST', '/sign-in')
    const newSession = await call('GET', '/account')
    expect(newSession.statusCode).toBe(200)
    expect(
      load(newSession.result)('main .app-account-summary-list').eq(2).text()
    ).toContain('Second Skipper')
    expect(
      load(newSession.result)('main .app-account-summary-list').eq(2).text()
    ).toContain('Second port')
    expect(
      fetchMock.mock.calls.some(
        ([, options]) => options.method === 'PATCH' || options.method === 'PUT'
      )
    ).toBe(false)
  })

  test('Should surface vessel profile API errors instead of showing another vessel preferences', async () => {
    await call('POST', '/sign-in')
    fetchMock.mockResolvedValue({ status: 403 })
    expect((await call('GET', '/account')).statusCode).toBe(403)
    const saved = await call(
      'POST',
      '/add-port?return=/account&vesselId=vessel-2',
      { port: 'Second port' }
    )
    expect(saved.statusCode).toBe(403)
  })

  test('Should keep interleaved gear measurements and skipper confirmations scoped to their account vessels', async () => {
    await seed()
    await call('POST', '/sign-in')
    await call('GET', '/account')
    const gearPath = (id) => `/add-gear?return=/account&vesselId=${id}`
    for (const id of ['vessel-1', 'vessel-2']) {
      expect(
        (await call('POST', gearPath(id), { gear: 'Test gear' })).statusCode
      ).toBe(303)
      expect(
        (
          await call('POST', `/skipper-details?vesselId=${id}`, {
            firstName: id === 'vessel-1' ? 'First' : 'Second',
            lastName: 'Skipper'
          })
        ).statusCode
      ).toBe(303)
    }
    for (const [id, measurement] of [
      ['vessel-2', '22'],
      ['vessel-1', '11']
    ]) {
      const saved = await call('POST', `${gearPath(id)}&step=measurements`, {
        'measurement-1': measurement
      })
      expect(saved.statusCode).toBe(303)
      const confirmed = await call('POST', `/skipper-check?vesselId=${id}`, {
        confirmSkipper: 'true'
      })
      expect(confirmed.statusCode).toBe(303)
    }
    const account = await call('GET', '/account')
    const $ = load(account.result)
    const lists = $('main .app-account-summary-list')
    expect(lists.eq(1).text()).toContain('First Skipper')
    expect(lists.eq(1).text()).not.toContain('Second Skipper')
    expect(lists.eq(1).text()).toContain('11')
    expect(lists.eq(2).text()).toContain('Second Skipper')
    expect(lists.eq(2).text()).toContain('22')
    const removed = await call('POST', '/remove-skipper?vesselId=vessel-1', {
      skipperIds: 'skipper-1'
    })
    expect(removed.statusCode).toBe(303)
    expect(vesselSkippers['vessel-1']).toEqual([])
    expect(vesselSkippers['vessel-2']).toEqual([
      { id: 'skipper-1', name: 'Second Skipper' }
    ])
    expect(account.request.yar.get('journey').catchRecordId).toBe(record.id)
    cookie = undefined
    await call('POST', '/sign-in')
    const fresh = await call('GET', '/account')
    expect(fresh.request.yar.get('vesselFavourites')['vessel-1']).toMatchObject(
      {
        favouriteGearIds: ['gear-1'],
        favouriteGearMeasurements: {}
      }
    )
  })

  test('Should not report success when the backend rejects a vessel favourite mutation', async () => {
    await call('POST', '/sign-in')
    const original = fetchMock.getMockImplementation()
    fetchMock.mockImplementation((url, options) =>
      options.method === 'POST'
        ? Promise.resolve({ status: 503 })
        : original(url, options)
    )
    for (const [path, payload] of [
      ['/add-port', { port: 'Second port' }],
      ['/add-gear', { gear: 'Recreational gear' }],
      ['/add-species', { species: 'Haddock' }]
    ]) {
      const saved = await call(
        'POST',
        `${path}?return=/account&vesselId=vessel-1`,
        payload
      )
      expect(saved.statusCode).toBe(503)
      expect(saved.headers.location).toBeUndefined()
    }
    expect(vesselFavourites['vessel-1']).toEqual({})
  })

  test('Should replace the new-record caption as soon as vessel submission creates a draft', async () => {
    await call('POST', '/records/new')
    const vessel = await call('GET', '/select-vessel')
    expect(load(vessel.result)('.govuk-caption-l').text().trim()).toBe(
      'New catch record'
    )
    expect(fetchMock).not.toHaveBeenCalled()
    const created = await call('POST', '/select-vessel', {
      vesselId: 'vessel-1'
    })
    expect(created.statusCode).toBe(303)
    const trip = await call('GET', created.headers.location)
    expect(load(trip.result)('.govuk-caption-l').text().trim()).toBe(
      record.catchRecordReference
    )
    const invalid = await call('POST', '/trip-date', {})
    expect(load(invalid.result)('.govuk-caption-l').text().trim()).toBe(
      record.catchRecordReference
    )
    await call('POST', '/records/new')
    const fresh = await call('GET', '/select-vessel')
    expect(load(fresh.result)('.govuk-caption-l').text().trim()).toBe(
      'New catch record'
    )
  })

  test.each([
    '/select-vessel',
    '/trip-date',
    '/trip-departure-date',
    '/trip-return-date',
    '/departure-port',
    '/return-port',
    '/confirm-same-port?port=GBABC',
    '/gear-selection',
    '/statistical-area?gearId=gear-1',
    '/statistical-area-other?gearId=gear-1',
    '/species-selection?gearId=gear-1',
    '/add-species?return=/species-selection&gearId=gear-1',
    '/catch-not-landed',
    '/species-not-landed',
    '/check-answers'
  ])(
    'Should display the saved reference above the heading on %s',
    async (path) => {
      await seed()
      if (path === '/departure-port') {
        await seed({ ...recordJourney(record), portSelectionStarted: true })
      }
      await seedFavourites({
        favouriteGearIds: ['gear-1'],
        favouriteSpeciesIds: ['species-1'],
        favouritePortIds: ['port-1']
      })
      const response = await call('GET', path)
      expect(response.statusCode).toBe(200)
      expect(
        load(response.result)('.govuk-caption-l').first().text().trim()
      ).toBe(record.catchRecordReference)
    }
  )

  test('Should retain the journey reference on Add species validation errors without changing the account caption', async () => {
    await seed()
    const invalid = await call(
      'POST',
      '/add-species?return=/species-selection&gearId=gear-1',
      { species: 'Unknown species' }
    )
    expect(invalid.statusCode).toBe(400)
    expect(load(invalid.result)('.govuk-caption-l').text().trim()).toBe(
      record.catchRecordReference
    )
    const account = await call('GET', '/add-species?return=/account')
    expect(account.statusCode).toBe(200)
    expect(load(account.result)('.govuk-caption-l').text().trim()).toBe(
      'Your favourites'
    )
  })

  test.each(['draft', 'details'])(
    'Should GET and prefill saved backend answers via the %s resume flow',
    async (entry) => {
      const second = structuredClone(record.gears[0])
      second.associationId = '00000000-0000-4000-8000-000000000202'
      second.gear.id = 'gear-2'
      second.gear.nameSnapshot = 'Recreational gear'
      second.characteristics = []
      second.statisticalArea.codeSnapshot = '29E8'
      second.speciesCaught[0] = {
        ...second.speciesCaught[0],
        id: 'species-2',
        nameSnapshot: 'Haddock',
        faoCodeSnapshot: 'HAD',
        weightAboveMinimumKg: 8
      }
      record.gears.push(second)
      record.trip.returnPort = {
        id: 'port-2',
        codeSnapshot: 'GBDEF',
        nameSnapshot: 'Second port'
      }
      await seed({
        catchRecordId: 'other-record',
        departureDate: '2025-08-20',
        returnDate: '2025-08-21'
      })
      const opened = await call(
        'GET',
        entry === 'draft'
          ? `/draft?recordId=${record.id}`
          : `/records/${record.id}`
      )
      expect(opened.statusCode).toBe(200)
      const actionKey = load(opened.result)('input[name="actionKey"]')
        .first()
        .val()
      // The second GET must supply the latest saved answers, not the list/open-page snapshot.
      record.version += 1
      record.trip.dateStarted = '2026-07-04'
      record.trip.dateEnded = '2026-07-05'
      const resumed = await call(
        'POST',
        entry === 'draft'
          ? `/draft?recordId=${record.id}`
          : `/records/${record.id}/resume`,
        entry === 'draft'
          ? { draftAction: 'complete', actionKey }
          : { actionKey }
      )
      if (entry === 'draft') {
        expect(resumed.statusCode).toBe(409)
        const refreshed = await call('GET', `/draft?recordId=${record.id}`)
        const refreshedKey = load(refreshed.result)(
          'input[name="actionKey"]'
        ).val()
        expect(
          (
            await call('POST', `/draft?recordId=${record.id}`, {
              draftAction: 'complete',
              actionKey: refreshedKey
            })
          ).statusCode
        ).toBe(303)
      } else {
        expect(resumed.statusCode).toBe(303)
      }
      const trip = await call('GET', '/trip-date')
      expect(load(trip.result)('input[value="no"]').prop('checked')).toBe(true)
      for (const [phase, day] of [
        ['departure', '4'],
        ['return', '5']
      ]) {
        const date = await call('GET', `/trip-${phase}-date`)
        const $date = load(date.result)
        const prefix =
          phase === 'departure' ? 'tripDepartureDate' : 'tripReturnDate'
        expect($date(`input[name="${prefix}-day"]`).val()).toBe(day)
        expect($date(`input[name="${prefix}-month"]`).val()).toBe('7')
        expect($date(`input[name="${prefix}-year"]`).val()).toBe('2026')
        const portRedirect = await call('GET', `/${phase}-port`)
        const port = await call('GET', portRedirect.headers.location)
        expect(load(port.result)('input[name="port"]').val()).toBe(
          phase === 'departure' ? 'Test port' : 'Second port'
        )
      }
      const gears = await call('GET', '/gear-selection')
      const $gears = load(gears.result)
      expect($gears('input[value="gear-1"]').prop('checked')).toBe(true)
      expect($gears('input[value="gear-2"]').prop('checked')).toBe(true)
      expect($gears('input[name="gear-1-measurement-1"]').val()).toBe('12')
      for (const [gearId, speciesId, weight] of [
        ['gear-1', 'species-1', '12.5'],
        ['gear-2', 'species-2', '8']
      ]) {
        const species = await call('GET', `/species-selection?gearId=${gearId}`)
        const $species = load(species.result)
        expect($species(`input[value="${speciesId}"]`).prop('checked')).toBe(
          true
        )
        expect(
          $species(`input[name="weightAboveMinimum-${speciesId}"]`).val()
        ).toBe(weight)
        expect(
          $species(`input[name="weightBelowMinimum-${speciesId}"]`).val()
        ).toBe('0')
        expect(getJourneyState(species.request).favouriteSpeciesIds).toEqual([])
      }
      expect(getJourneyState(gears.request)).toMatchObject({
        catchRecordId: record.id,
        version: record.version,
        catchDetailsByGearId: {
          'gear-1': { selectedStatisticalArea: '30E5' },
          'gear-2': { selectedStatisticalArea: '29E8' }
        },
        favouriteGearIds: [],
        favouritePortIds: []
      })
      for (const [gearId, code] of [
        ['gear-1', '30E5'],
        ['gear-2', '29E8']
      ]) {
        const area = await call('GET', `/statistical-area?gearId=${gearId}`)
        expect(area.statusCode).toBe(200)
        expect(
          load(area.result)('[data-statistical-area-map]').attr(
            'data-selected-area'
          )
        ).toBe(code)
        const manual = await call(
          'GET',
          `/statistical-area-other?gearId=${gearId}`
        )
        expect(manual.statusCode).toBe(200)
        const $manual = load(manual.result)
        const selected = $manual('input[name="statisticalArea"]:checked').val()
        expect(
          selected === 'other'
            ? $manual('input[name="alternativeStatisticalArea"]').val()
            : selected
        ).toBe(code)
      }
      expect(
        fetchMock.mock.calls.every(([, options]) => options.method === 'GET')
      ).toBe(true)
      expect(
        fetchMock.mock.calls.filter(([url]) =>
          url.endsWith(`/v1/catch-records/${record.id}`)
        ).length
      ).toBeGreaterThanOrEqual(2)
    }
  )

  test('Should restore a manual area on the map without changing it or selecting an unsaved area', async () => {
    const state = recordJourney(record)
    await seed({
      ...state,
      catchDetailsByGearId: {
        'gear-1': {
          ...state.catchDetailsByGearId['gear-1'],
          statAreaBranch: 'other',
          selectedStatisticalArea: 'other',
          selectedAlternativeAreaOption: 'other',
          alternativeStatisticalArea: '30E53'
        }
      }
    })
    const map = await call('GET', '/statistical-area?gearId=gear-1')
    expect(
      load(map.result)('[data-statistical-area-map]').attr('data-selected-area')
    ).toBe('30E53')
    const manual = await call('GET', '/statistical-area-other?gearId=gear-1')
    expect(load(manual.result)('input[value="other"]').prop('checked')).toBe(
      true
    )
    expect(
      load(manual.result)('input[name="alternativeStatisticalArea"]').val()
    ).toBe('30E53')
    await seed({
      ...state,
      catchDetailsByGearId: { 'gear-1': {} }
    })
    const empty = await call('GET', '/statistical-area?gearId=gear-1')
    expect(
      load(empty.result)('[data-statistical-area-map]').attr(
        'data-selected-area'
      )
    ).toBe('')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('Should open the design summary from the submitted trip date using backend snapshots', async () => {
    record.status = 'SUBMITTED'
    record.displayStatus = 'Submitted'
    const before = structuredClone(record)
    const listed = await call('GET', '/records')
    const $list = load(listed.result)
    const dateLink = $list('tbody tr').first().find('td').eq(2).find('a')
    expect(dateLink.text()).toContain('2 Jun 2026')
    expect(dateLink.attr('href')).toBe(`/records/${record.id}`)
    const response = await call('GET', dateLink.attr('href'))
    expect(response.statusCode).toBe(200)
    const $ = load(response.result)
    expect($('h1').text()).toBe('Catch record for TEST VESSEL')
    expect($('.govuk-caption-l').text()).toBe(record.catchRecordReference)
    expect(
      $('main h2')
        .map((_, item) => $(item).text())
        .get()
    ).toEqual([
      'Trips details',
      '2. Gear used',
      '3. Species caught',
      'Species not landed'
    ])
    const rows = $('.govuk-summary-list__row')
    const value = (label) =>
      rows
        .filter((_, item) => $(item).find('dt').text().trim() === label)
        .first()
        .find('dd')
        .text()
        .trim()
    expect(value('Vessel')).toBe('TEST VESSEL')
    expect(value('Departure date')).toBe('1 June 2026')
    expect(value('Statistical sub area')).toBe('30E5')
    expect(value('Gear type')).toBe('Test gear')
    expect(value('Length')).toBe('12')
    expect($('[data-summary-section="species"] h3').text()).toBe('Cod (COD)')
    expect(value('Weight below minimum size retained (kg)')).toBe('0')
    expect(
      value('Weight above minimum size kept onboard or in keep pots (kg)')
    ).toBe('1')
    expect($(`a[href="/records/${record.id}/edit-reason"]`).text()).toContain(
      'Edit catch record'
    )
    expect($('a.govuk-button--secondary').attr('href')).toBe(
      `/records/${record.id}/submissions/1/pdf`
    )
    expect($('.govuk-summary-list__actions')).toHaveLength(0)
    expect($('[data-summary-section="gear"]')).toHaveLength(1)
    expect($('[data-summary-section="species"]')).toHaveLength(1)
    expect($('[data-summary-section="species"] .govuk-body').text()).toBe(
      'Caught with Test gear'
    )
    expect($('main .govuk-details')).toHaveLength(0)
    expect($(`a[href="/records/${record.id}/history"]`)).toHaveLength(0)
    expect(record).toEqual(before)
    expect(
      fetchMock.mock.calls.every(([, options]) => options.method === 'GET')
    ).toBe(true)
  })

  test('Should repeat the Figma gear and species blocks without mixing saved answers or copying Check Your Answers', async () => {
    record.status = 'SUBMITTED'
    const second = structuredClone(record.gears[0])
    second.associationId = '00000000-0000-4000-8000-000000000202'
    second.gear = {
      ...second.gear,
      id: 'gear-2',
      nameSnapshot: 'Second gear <snapshot>'
    }
    second.characteristics[0].value = 42
    second.characteristics[0].unitSnapshot = 'mm'
    second.statisticalArea.codeSnapshot = '29E8'
    second.speciesCaught[0].weightAboveMinimumKg = 99
    second.speciesCaught.push({
      id: 'species-2',
      nameSnapshot: 'Haddock',
      faoCodeSnapshot: 'HAD',
      weightAboveMinimumKg: 3,
      weightBelowMinimumKg: 0,
      weightLegallyDiscardedKg: 1
    })
    record.gears.push(second)
    const before = structuredClone(record)
    const response = await call('GET', `/records/${record.id}`)
    expect(response.statusCode).toBe(200)
    const $ = load(response.result)
    const blocks = $('main section[aria-labelledby^="submitted-summary-"]')
    expect(
      $('main h2')
        .map((_, element) => $(element).text())
        .get()
    ).toEqual([
      'Trips details',
      '2. Gear used',
      '3. Species caught',
      'Species not landed'
    ])
    const firstGear = $('[data-summary-section="gear"][data-gear-id="gear-1"]')
    const secondGear = $('[data-summary-section="gear"][data-gear-id="gear-2"]')
    const firstSpecies = $(
      '[data-summary-section="species"][data-gear-id="gear-1"]'
    )
    const secondGearSpecies = $(
      '[data-summary-section="species"][data-gear-id="gear-2"]'
    )
    const secondSpecies = secondGearSpecies.first()
    const haddock = secondGearSpecies.last()
    expect(firstGear.text()).toContain('Test gear')
    expect(firstGear.text()).not.toContain('42')
    expect(secondGear.text()).toContain('Second gear <snapshot>')
    expect(secondGear.text()).toContain('Length')
    expect(secondGear.text()).not.toContain('Length (mm)')
    expect(firstGear.find('h3').text()).toBe('Test gear')
    expect(secondGear.find('h3').text()).toBe('Second gear <snapshot>')
    expect(firstGear.text()).toContain('Area majority catch caught')
    expect(firstGear.text()).toContain('30E5')
    expect(firstGear.text()).not.toContain('29E8')
    expect(firstGear.text()).not.toContain('Haddock')
    expect(secondGear.text()).toContain('29E8')
    expect(secondGear.text()).toContain('Cod (COD), Haddock (HAD)')
    expect(secondGear.text()).toContain('42')
    expect(firstSpecies.find('p').text()).toBe('Caught with Test gear')
    expect(firstSpecies.find('dd').first().text().trim()).toBe('12.5')
    expect(firstSpecies.text()).not.toContain('99')
    expect(firstSpecies.text()).not.toContain('Haddock')
    expect(secondSpecies.find('p').text()).toBe(
      'Caught with Second gear <snapshot>'
    )
    expect(firstSpecies.find('h3').text()).toBe('Cod (COD)')
    expect(secondSpecies.find('h3').text()).toBe('Cod (COD)')
    expect(secondSpecies.find('dd').first().text().trim()).toBe('99')
    expect(secondSpecies.text()).not.toContain('Haddock')
    expect(haddock.find('h3').text()).toBe('Haddock (HAD)')
    expect(
      haddock
        .find('dd')
        .map((_, element) => $(element).text().trim())
        .get()
    ).toEqual(['3', '0', '1'])
    expect($('snapshot')).toHaveLength(0)
    expect(blocks.first().find('.govuk-summary-list__row')).toHaveLength(7)
    expect(blocks.first().text()).toContain('Statistical sub area (Test gear)')
    expect(blocks.first().text()).toContain('30E5')
    expect(blocks.first().text()).toContain(
      'Statistical sub area (Second gear <snapshot>)'
    )
    expect(blocks.first().text()).toContain('29E8')
    const ids = blocks
      .map((_, element) => $(element).attr('aria-labelledby'))
      .get()
    expect(new Set(ids).size).toBe(blocks.length)
    for (const id of ids) {
      expect($(`#${id}`)).toHaveLength(1)
    }
    expect($('main h3')).toHaveLength(5)
    expect($('.govuk-summary-list__actions')).toHaveLength(0)
    expect($('input[name="confirmAccurate"]')).toHaveLength(0)
    expect($(`a[href="/records/${record.id}/edit-reason"]`).text()).toContain(
      'Edit catch record'
    )
    expect(
      $(`a[href="/records/${record.id}/submissions/1/pdf"]`).text()
    ).toContain('Download PDF')
    expect(record).toEqual(before)
    expect(
      fetchMock.mock.calls.every(([, options]) => options.method === 'GET')
    ).toBe(true)
  })

  test('Should omit the primary PDF button when the submitted record has no PDF artifact', async () => {
    record.status = 'SUBMITTED'
    fetchMock
      .mockResolvedValueOnce({
        status: 200,
        json: async () => record
      })
      .mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          catchRecordId: record.id,
          count: 0,
          submissions: []
        })
      })
    const response = await call('GET', `/records/${record.id}`)
    expect(response.statusCode).toBe(200)
    const $ = load(response.result)
    expect($('a.govuk-button--secondary')).toHaveLength(0)
    expect($('main .govuk-details')).toHaveLength(0)
    expect($(`a[href="/records/${record.id}/edit-reason"]`).text()).toContain(
      'Edit catch record'
    )
  })

  test('Should list backend records rather than fixture records', async () => {
    const response = await call('GET', '/records?status=DRAFT')
    expect(response.statusCode).toBe(200)
    const $ = load(response.result)
    expect($('tbody').text()).toContain('TEST VESSEL')
    expect($('tbody').text()).not.toContain('OLGA')
    expect(fetchMock.mock.calls[0][0]).toContain('limit=100&status=DRAFT')
  })

  test('Should render status, progress, snapshots and submission links', async () => {
    await openRecord()
    const response = await call('GET', `/records/${record.id}`)
    const $ = load(response.result)
    expect($('main').text()).toContain('TEST VESSEL')
    expect($('main').text()).toContain('Not complete')
    expect($('main').text()).toContain('12.5')
    expect($(`a[href="/records/${record.id}/submissions/1/pdf"]`)).toHaveLength(
      1
    )
  })

  test('Should show history from the API', async () => {
    const response = await call('GET', `/records/${record.id}/history`)
    expect(response.statusCode).toBe(200)
    expect(load(response.result)('main').text()).toContain('CREATED')
  })

  test('Should hide and reject staff completion when its feature flag is disabled', async () => {
    config.set('catchRecording.completionEnabled', false)
    record.status = 'SUBMITTED'
    const actionKey = await openRecord()
    const details = await call('GET', `/records/${record.id}`)
    expect(
      load(details.result)(`form[action="/records/${record.id}/complete"]`)
    ).toHaveLength(0)
    const response = await call('POST', `/records/${record.id}/complete`, {
      actionKey
    })
    expect(response.statusCode).toBe(404)
    expect(
      fetchMock.mock.calls.some(([url]) => url.endsWith('/completion'))
    ).toBe(false)
  })

  test('Should expose staff completion only for a submitted record and use its displayed version', async () => {
    config.set('catchRecording.completionEnabled', true)
    record.status = 'SUBMITTED'
    record.displayStatus = 'Submitted'
    const details = await call('GET', `/records/${record.id}`)
    const $ = load(details.result)
    expect($(`form[action="/records/${record.id}/complete"]`)).toHaveLength(1)
    const actionKey = $('input[name="actionKey"]').first().val()
    const response = await call('POST', `/records/${record.id}/complete`, {
      actionKey
    })
    expect(response.statusCode).toBe(303)
    expect(response.headers.location).toBe(`/records/${record.id}`)
    const [, options] = fetchMock.mock.calls.find(([url]) =>
      url.endsWith('/completion')
    )
    expect(options.headers['If-Match']).toBe('5')
    expect(options.headers['Idempotency-Key']).toBe(actionKey)
    const refreshed = await call('GET', `/records/${record.id}`)
    expect(load(refreshed.result)('main').text()).toContain('Complete')
    expect(
      load(refreshed.result)(`form[action="/records/${record.id}/complete"]`)
    ).toHaveLength(0)
  })

  test('Should reject completion of a draft even when the staff flag is enabled', async () => {
    config.set('catchRecording.completionEnabled', true)
    const actionKey = await openRecord()
    const response = await call('POST', `/records/${record.id}/complete`, {
      actionKey
    })
    expect(response.statusCode).toBe(409)
    expect(
      fetchMock.mock.calls.some(([url]) => url.endsWith('/completion'))
    ).toBe(false)
  })

  test('Should surface backend permission denial for staff completion', async () => {
    config.set('catchRecording.completionEnabled', true)
    record.status = 'SUBMITTED'
    const actionKey = await openRecord()
    const upstream = fetchMock.getMockImplementation()
    fetchMock.mockImplementation((url, options) =>
      url.endsWith('/completion')
        ? Promise.resolve({ status: 403 })
        : upstream(url, options)
    )
    const response = await call('POST', `/records/${record.id}/complete`, {
      actionKey
    })
    expect(response.statusCode).toBe(403)
    expect(record.status).toBe('SUBMITTED')
  })

  test('Should return artifact bytes with controlled attachment headers', async () => {
    const response = await call(
      'GET',
      `/records/${record.id}/submissions/1/pdf`
    )
    expect(response.statusCode).toBe(200)
    expect(response.rawPayload).toEqual(Buffer.from('%PDF-test'))
    expect(response.headers['content-type']).toBe('application/pdf')
    expect(response.headers['content-disposition']).toContain(
      'attachment; filename="catch-record-1.pdf"'
    )
    expect(response.headers['cache-control']).toBe('private, no-store')
  })

  test('Should resume the canonical record with its version and association IDs', async () => {
    const actionKey = await openRecord()
    const response = await call('POST', `/records/${record.id}/resume`, {
      actionKey
    })
    expect(response.statusCode).toBe(303)
    expect(response.headers.location).toBe('/trip-date')
    expect(getJourneyState(response.request)).toMatchObject(
      recordJourney(record)
    )
  })

  test('Should delete only using the displayed version and clear matching journey', async () => {
    await seed()
    const actionKey = await openRecord()
    const response = await call('POST', `/records/${record.id}/delete`, {
      actionKey
    })
    expect(response.statusCode).toBe(303)
    expect(getJourneyState(response.request)).toEqual({})
    expect(
      fetchMock.mock.calls.find(([, options]) => options.method === 'DELETE')[1]
        .headers['If-Match']
    ).toBe('5')
  })

  test('Should reject lifecycle actions that have not been opened and confirmed', async () => {
    const response = await call('POST', `/records/${record.id}/delete`, {
      actionKey: '00000000-0000-4000-8000-000000000001'
    })
    expect(response.statusCode).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('Should route the legacy edit action to the reason page without starting an amendment', async () => {
    record.status = 'SUBMITTED'
    record.displayStatus = 'Submitted'
    const actionKey = await openRecord()
    const response = await call('POST', `/records/${record.id}/edit`, {
      actionKey
    })
    expect(response.statusCode).toBe(303)
    expect(response.headers.location).toBe(`/records/${record.id}/edit-reason`)
    expect(
      fetchMock.mock.calls.some(([url]) => url.endsWith('/edit-start'))
    ).toBe(false)
  })

  test('Should collect an edit reason, amend existing answers and resubmit the same record', async () => {
    record.status = 'SUBMITTED'
    record.displayStatus = 'Submitted'
    record.numberOfSubmissions = 1
    record.submittedAt = '2026-06-02T13:35:00Z'
    record.submittedBy = 'test-submitter'
    const reference = record.catchRecordReference
    const listedStatus = async () => {
      const response = await call('GET', '/records')
      expect(response.statusCode).toBe(200)
      return load(response.result)('tbody .govuk-tag').text().trim()
    }
    expect(await listedStatus()).toBe('Submitted')
    const reasonPath = `/records/${record.id}/edit-reason`
    const reviewPath = `/records/${record.id}/edit-review`
    const unopened = await call('GET', reviewPath)
    expect(unopened.headers.location).toBe(reasonPath)
    const reason = await call('GET', reasonPath)
    expect(reason.statusCode).toBe(200)
    const $reason = load(reason.result)
    expect($reason('h1').text().trim()).toBe(
      'Why are you editing this catch record?'
    )
    expect($reason('.govuk-notification-banner').text()).toContain(
      '2 June 2026'
    )
    expect($reason('.govuk-caption-l').text()).toBe(reference)
    const reasonKey = $reason('input[name="reasonKey"]').val()
    const invalidReason = await call('POST', reasonPath, {
      editReason: '',
      reasonKey
    })
    expect(invalidReason.statusCode).toBe(400)
    expect(record.status).toBe('SUBMITTED')
    const started = await call('POST', reasonPath, {
      editReason: 'Correct the return port',
      reasonKey
    })
    expect(started.statusCode).toBe(303)
    expect(started.headers.location).toBe(reviewPath)
    expect(record.status).toBe('DRAFT')
    record.displayStatus = 'Amended'
    expect(await listedStatus()).toBe('Draft')
    expect(getJourneyState(started.request)).toMatchObject({
      catchRecordId: record.id,
      reference,
      version: 6,
      selectedGearIds: ['gear-1']
    })
    const edit = fetchMock.mock.calls.find(([url]) =>
      url.endsWith('/edit-start')
    )
    expect(edit[1].headers['If-Match']).toBe('5')
    expect(edit[1].body).toBeUndefined()
    const reviewed = await call('GET', reviewPath)
    expect(reviewed.statusCode).toBe(200)
    const $review = load(reviewed.result)
    expect($review('h1').text()).toBe('Edit catch record for TEST VESSEL')
    expect($review('.govuk-notification-banner').text()).toContain(
      'test-submitter'
    )
    expect($review('.govuk-notification-banner').text()).toContain(
      '2 June 2026'
    )
    expect($review('a[href*="/select-vessel"]')).toHaveLength(0)
    expect($review('a[href*="gearId=gear-1"]')).not.toHaveLength(0)
    expect(
      $review('a[href="/return-port?return=/check-answers"]')
    ).toHaveLength(1)
    const submissionKey = $review('input[name="submissionKey"]').val()
    const invalidDeclaration = await call('POST', reviewPath, { submissionKey })
    expect(invalidDeclaration.statusCode).toBe(400)
    expect(
      fetchMock.mock.calls.some(([, options]) => options.method === 'PUT')
    ).toBe(false)
    const changed = await call('POST', '/return-port?return=/check-answers', {
      returnPort: 'GBDEF'
    })
    expect(changed.headers.location).toBe('/check-answers')
    expect((await call('GET', changed.headers.location)).headers.location).toBe(
      reviewPath
    )
    const updated = await call('GET', reviewPath)
    expect(updated.result).toContain('Second port')
    const updatedKey = load(updated.result)('input[name="submissionKey"]').val()
    const submitted = await call('POST', reviewPath, {
      confirmAccurate: 'true',
      submissionKey: updatedKey
    })
    expect(submitted.statusCode).toBe(303)
    expect(submitted.headers.location).toBe('/confirmation')
    expect(getJourneyState(submitted.request)).toMatchObject({
      catchRecordId: record.id,
      submittedRecordId: record.id,
      reference
    })
    expect(submitted.request.yar.get('amendment')).toBeFalsy()
    expect(record.status).toBe('SUBMITTED')
    expect(record.numberOfSubmissions).toBe(2)
    expect(await listedStatus()).toBe('Amended')
    const replacement = fetchMock.mock.calls.find(
      ([, options]) => options.method === 'PUT'
    )
    expect(JSON.parse(replacement[1].body).trip.returnPort.id).toBe('port-2')
    const submission = fetchMock.mock.calls.find(([url]) =>
      url.endsWith('/submission')
    )
    expect(Number(submission[1].headers['If-Match'])).toBeGreaterThan(6)
    expect(
      fetchMock.mock.calls.filter(([url]) => url.endsWith('/edit-start'))
    ).toHaveLength(1)
    expect(
      fetchMock.mock.calls.some(
        ([url, options]) =>
          url.endsWith('/v1/catch-records') && options.method === 'POST'
      )
    ).toBe(false)
    expect(
      (
        await call('POST', reviewPath, {
          confirmAccurate: 'true',
          submissionKey: updatedKey
        })
      ).statusCode
    ).toBe(400)
  })

  test('Should reject a missing reason action key and stale record before starting an amendment', async () => {
    record.status = 'SUBMITTED'
    const path = `/records/${record.id}/edit-reason`
    expect(
      (await call('POST', path, { editReason: 'Correction' })).statusCode
    ).toBe(400)
    const opened = await call('GET', path)
    const reasonKey = load(opened.result)('input[name="reasonKey"]').val()
    record.version += 1
    const stale = await call('POST', path, {
      editReason: 'Correction',
      reasonKey
    })

    expect(stale.statusCode).toBe(409)
    expect(
      fetchMock.mock.calls.some(([url]) => url.endsWith('/edit-start'))
    ).toBe(false)
  })

  test('Should not reuse another record amendment reason or metadata', async () => {
    record.status = 'SUBMITTED'
    await seed()
    await call('POST', '/test/amendment', {
      recordId: 'other-record',
      version: 5,
      key: '00000000-0000-4000-8000-000000000001',
      reasonProvided: true,
      editReason: 'Other record reason',
      submittedBy: 'other-user'
    })
    const path = `/records/${record.id}/edit-reason`
    const opened = await call('GET', path)
    expect(opened.request.yar.get('amendment').reasonProvided).toBeUndefined()
    expect(opened.request.yar.get('amendment').editReason).toBeUndefined()
    const reasonKey = load(opened.result)('input[name="reasonKey"]').val()
    const started = await call('POST', path, {
      editReason: 'This record correction',
      reasonKey
    })
    expect(started.statusCode).toBe(303)
    expect(record.status).toBe('DRAFT')
    expect(started.request.yar.get('amendment').editReason).toBe(
      'This record correction'
    )
  })

  test('Should retain the reason page and submitted record when edit-start fails', async () => {
    record.status = 'SUBMITTED'
    const path = `/records/${record.id}/edit-reason`
    const opened = await call('GET', path)
    const reasonKey = load(opened.result)('input[name="reasonKey"]').val()
    const upstream = fetchMock.getMockImplementation()
    fetchMock.mockImplementation((url, options) =>
      url.endsWith('/edit-start')
        ? Promise.resolve({
            status: 503,
            json: async () => ({ message: 'Unavailable' })
          })
        : upstream(url, options)
    )
    const failed = await call('POST', path, {
      editReason: 'Correction',
      reasonKey
    })
    expect(failed.statusCode).toBe(503)
    expect(record.status).toBe('SUBMITTED')
    expect(failed.request.yar.get('amendment').reasonProvided).not.toBe(true)
    const review = await call('GET', `/records/${record.id}/edit-review`)
    expect(review.headers.location).toBe(path)
  })

  test('Should reject repeated gear types before starting an amendment', async () => {
    record.gears.push({
      ...record.gears[0],
      associationId: 'another-association'
    })
    const actionKey = await openRecord()
    const response = await call('POST', `/records/${record.id}/edit`, {
      actionKey
    })
    expect(response.statusCode).toBe(409)
    expect(
      fetchMock.mock.calls.some(([, options]) => options.method === 'POST')
    ).toBe(false)
  })

  test('Should PATCH successful trip answers and advance the session version', async () => {
    await seed()
    const response = await call('POST', '/trip-date', { tripSameDate: 'yes' })
    expect(response.statusCode).toBe(303)
    expect(getJourneyState(response.request).version).toBe(6)
    const [, options] = fetchMock.mock.calls.find(
      ([, options]) => options.method === 'PATCH'
    )
    expect(options.headers['If-Match']).toBe('5')
    expect(JSON.parse(options.body)).toMatchObject({
      section: 'trip',
      data: { startedAndFinishedToday: true, departurePort: { id: 'port-1' } }
    })
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/London',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date())
    expect(JSON.parse(options.body).data.dateStarted).toBe(today)
  })

  test('Should not PATCH invalid form submissions', async () => {
    await seed()
    const response = await call('POST', '/trip-date', {})
    expect([200, 400]).toContain(response.statusCode)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('Should permit retry after a statistical-area dependency failure before any write', async () => {
    const state = recordJourney(record)
    state.catchDetailsByGearId['gear-1'].selectedStatisticalArea = undefined
    await seed(state)
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503 })
    const failed = await call('POST', '/statistical-area?gearId=gear-1', {
      statisticalArea: '30E53'
    })
    expect(failed.statusCode).toBe(503)
    expect(getJourneyState(failed.request)).toEqual(state)
    expect(
      fetchMock.mock.calls.some(([, options]) => options.method === 'PATCH')
    ).toBe(false)
    const retried = await call('POST', '/statistical-area?gearId=gear-1', {
      statisticalArea: '30E53'
    })
    expect(retried.statusCode).toBe(303)
    expect(retried.headers.location).toContain('/species-selection')
    expect(getJourneyState(retried.request).catchRecordReloadRequired).not.toBe(
      true
    )
    expect(fetchMock.mock.calls[0][0]).toContain('query=30E53')
  })

  test('Should save a raw ArcGIS statistical area using OBJECTID as the reference ID', async () => {
    const state = recordJourney(record)
    state.catchDetailsByGearId['gear-1'].selectedStatisticalArea = undefined
    await seed(state)
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        type: 'FeatureCollection',
        metadata: { dataset: 'map-statistical-areas' },
        features: [
          {
            type: 'Feature',
            properties: {
              OBJECTID: 30028,
              ICESNAME: '30E5',
              sub_code: '30E52'
            },
            geometry: {}
          },
          {
            type: 'Feature',
            properties: {
              OBJECTID: 30029,
              ICESNAME: '30E5',
              sub_code: '30E53'
            },
            geometry: {}
          }
        ]
      })
    })
    const response = await call('POST', '/statistical-area?gearId=gear-1', {
      statisticalArea: '30E53'
    })
    expect(response.statusCode).toBe(303)
    expect(response.headers.location).toContain('/species-selection')
    const [, options] = fetchMock.mock.calls.find(
      ([, options]) => options.method === 'PATCH'
    )
    expect(JSON.parse(options.body)).toMatchObject({
      section: 'gears',
      data: [{ statisticalArea: { id: '30029' } }]
    })
  })

  test('Should not save a statistical area the Reference Data Service cannot identify', async () => {
    const state = recordJourney(record)
    state.catchDetailsByGearId['gear-1'].selectedStatisticalArea = undefined
    await seed(state)
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        type: 'FeatureCollection',
        metadata: { dataset: 'map-statistical-areas' },
        features: [
          {
            type: 'Feature',
            properties: { ICESNAME: '30E5', sub_code: '30E53' },
            geometry: {}
          }
        ]
      })
    })
    const response = await call('POST', '/statistical-area?gearId=gear-1', {
      statisticalArea: '30E53'
    })
    expect(response.statusCode).toBe(400)
    expect(response.result).toContain(
      'Select a statistical area available from the Reference Data Service'
    )
    expect(getJourneyState(response.request)).toEqual(state)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test.each(['no', 'yes'])(
    'Should complete the HTTP journey from vessel to submission with unlanded catch=%s',
    async (catchNotLanded) => {
      record = canonicalCatchRecord({
        version: 1,
        trip: {},
        gears: [],
        speciesNotLanded: []
      })
      async function post(url, payload, next) {
        const response = await call('POST', url, payload)
        expect(response.statusCode, `${url}: ${response.result}`).toBe(303)
        expect(response.headers.location).toContain(next)
        return response
      }
      await post('/records/new', undefined, '/select-vessel')
      expect((await call('GET', '/select-vessel')).statusCode).toBe(200)
      await post('/select-vessel', { vesselId: 'vessel-1' }, '/trip-date')
      await post('/trip-date', { tripSameDate: 'yes' }, '/departure-port')
      const noPorts = await call('GET', '/departure-port')
      expect(noPorts.headers.location).toBe('/add-port?for=departure&entry=1')
      await post(
        '/add-port?for=departure',
        { port: 'Test port' },
        '/return-port'
      )
      await post(
        '/add-port?for=return',
        { port: 'Test port' },
        '/gear-selection'
      )
      await post('/add-gear', { gear: 'Test gear' }, '/add-gear')
      await post('/add-gear', { 'measurement-1': '12' }, '/gear-selection')
      await post(
        '/gear-selection',
        { gearIds: 'gear-1', 'gear-1-measurement-1': '12' },
        '/statistical-area'
      )
      await post(
        '/statistical-area?gearId=gear-1',
        { statisticalArea: '30E53' },
        '/species-selection'
      )
      await post(
        '/add-species?gearId=gear-1',
        { species: 'Cod' },
        '/species-selection'
      )
      await post(
        '/species-selection?gearId=gear-1',
        {
          speciesIds: 'species-1',
          speciesAction: 'continue',
          'weightAboveMinimum-species-1': '12.5'
        },
        '/catch-not-landed'
      )
      await post(
        '/catch-not-landed',
        { catchNotLanded },
        catchNotLanded === 'yes' ? '/species-not-landed' : '/check-answers'
      )
      if (catchNotLanded === 'yes') {
        await post(
          '/species-not-landed',
          {
            speciesIds: 'species-1',
            'weightAboveMinimum-species-1': '1.5'
          },
          '/check-answers'
        )
        expect(record.speciesNotLanded).toEqual([
          { id: 'species-1', weightAboveMinimumKg: 1.5 }
        ])
      }
      const review = await call('GET', '/check-answers')
      expect(review.statusCode).toBe(200)
      const submissionKey = load(review.result)(
        'input[name="submissionKey"]'
      ).val()
      expect(submissionKey).toBeTruthy()
      await post('/check-answers', { submissionKey }, '/confirmation')
      const confirmation = await call('GET', '/confirmation')
      expect(confirmation.statusCode).toBe(200)
      expect(confirmation.result).toContain(record.catchRecordReference)
      expect(getJourneyState(confirmation.request)).toMatchObject({
        favouritePortIds: [],
        favouriteGearIds: [],
        favouriteGearMeasurements: {},
        favouriteSpeciesIds: []
      })
      expect(record.gears[0]).toMatchObject({
        statisticalArea: { id: 'area-1' },
        speciesCaught: [{ id: 'species-1', weightAboveMinimumKg: 12.5 }]
      })
      expect(
        fetchMock.mock.calls.filter(
          ([url, options]) =>
            url.endsWith('/v1/catch-records') && options.method === 'POST'
        )
      ).toHaveLength(1)
    }
  )

  test.each([409, 503])(
    'Should roll back local answers on PATCH failure %s without retrying',
    async (status) => {
      await seed()
      fetchMock.mockResolvedValue({ status })
      const response = await call('POST', '/trip-date', { tripSameDate: 'yes' })
      expect(response.statusCode).toBe(status)
      expect(getJourneyState(response.request)).toEqual({
        ...recordJourney(record),
        catchRecordReloadRequired: true
      })
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const retry = await call('POST', '/trip-date', { tripSameDate: 'yes' })
      expect(retry.statusCode).toBe(409)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    }
  )

  test.each([
    '/add-port?',
    '/add-gear',
    '/add-species',
    '/remove-port',
    '/remove-gear',
    '/remove-species'
  ])(
    'Should manage session favourites without a vessel on %s',
    async (path) => {
      const response = await call('GET', path)
      expect(response.statusCode).toBe(200)
      expect(load(response.result)('h1').text()).toContain('favourites')
      expect(load(response.result)('h1').text()).not.toContain('OLGA')
      expect(fetchMock).not.toHaveBeenCalled()
    }
  )

  test.each([
    [
      '/add-port?for=departure&entry=1',
      'Enter the port or closest port you set off from'
    ],
    ['/add-port?for=return', 'Enter the port or closest port you returned to']
  ])(
    'Should retain the original trip-port design on %s',
    async (path, heading) => {
      await seed({
        ...recordJourney(record),
        departurePort: null,
        returnPort: null
      })
      for (const method of ['GET', 'POST']) {
        const response = await call(
          method,
          path,
          method === 'POST' ? { port: '' } : undefined
        )
        expect(response.statusCode).toBe(method === 'POST' ? 400 : 200)
        const $ = load(response.result)
        expect($('h1').text().trim()).toBe(heading)
        expect($('.govuk-caption-l').text().trim()).toBe(
          record.catchRecordReference
        )
        expect($('label[for="port"]').text().trim()).toBe(heading)
        expect($('[data-port-search]').attr('placeholder')).toBe(
          'Start typing to display the list'
        )
        expect($('.app-autocomplete__arrow')).toHaveLength(1)
        expect($('.govuk-button').text().trim()).toBe('Save and continue')
        expect($('form').attr('action')).toBe(path)
      }
      expect(
        fetchMock.mock.calls.every(([, options]) => options.method === 'GET')
      ).toBe(true)
    }
  )

  test('Should retain the account favourites heading independently of trip entry parameters', async () => {
    const response = await call(
      'GET',
      '/add-port?for=departure&return=/account'
    )
    const $ = load(response.result)
    expect(response.statusCode).toBe(200)
    expect($('h1').text().trim()).toBe('Add a port to your favourites')
    expect($('.govuk-caption-l').text().trim()).toBe('Your favourites')
  })

  test.each([
    ['new', false],
    ['draft', false],
    ['new', true],
    ['draft', true]
  ])(
    'Should use the correct port screens for %s with favourites=%s (cases 1-4)',
    async (kind, favourites) => {
      if (kind === 'new') {
        await call('POST', '/records/new')
        await call('GET', '/select-vessel')
        await call('POST', '/select-vessel', { vesselId: 'vessel-1' })
        await seed({
          ...recordJourney(record),
          departurePort: null,
          returnPort: null
        })
      } else {
        record.trip = {
          ...record.trip,
          departurePort: undefined,
          returnPort: undefined
        }
        const actionKey = await openRecord()
        await call('POST', `/records/${record.id}/resume`, { actionKey })
      }
      if (favourites) {
        await seedFavourites({ favouritePortIds: ['port-1', 'port-2'] })
      }
      const departure = await call('GET', '/departure-port')
      if (favourites) {
        expect(departure.statusCode).toBe(200)
        expect(
          load(departure.result)('input[name="departurePort"]')
        ).toHaveLength(2)
      } else {
        expect(departure.headers.location).toBe(
          '/add-port?for=departure&entry=1'
        )
        expect((await call('GET', departure.headers.location)).statusCode).toBe(
          200
        )
      }
      const selected = favourites
        ? await call('POST', '/departure-port', { departurePort: 'GBABC' })
        : await call('POST', departure.headers.location, { port: 'Test port' })
      expect(selected.statusCode).toBe(303)
      expect(selected.headers.location).toBe('/return-port')
      const returning = await call('GET', '/return-port')
      if (favourites) {
        expect(returning.statusCode).toBe(200)
        expect(load(returning.result)('input[name="returnPort"]')).toHaveLength(
          2
        )
      } else {
        expect(returning.headers.location).toBe('/add-port?for=return')
        expect((await call('GET', returning.headers.location)).statusCode).toBe(
          200
        )
      }
      const saved = favourites
        ? await call('POST', '/return-port', { returnPort: 'GBDEF' })
        : await call('POST', returning.headers.location, {
            port: 'Second port'
          })
      expect(saved.statusCode).toBe(303)
      expect(saved.headers.location).toBe('/gear-selection')
      expect(getJourneyState(saved.request)).toMatchObject({
        departurePort: 'GBABC',
        returnPort: 'GBDEF',
        favouritePortIds: favourites ? ['port-1', 'port-2'] : []
      })
      expect(record.trip.departurePort.id).toBe('port-1')
      expect(record.trip.returnPort.id).toBe('port-2')
      expect(
        fetchMock.mock.calls.some(
          ([url, options]) =>
            url.includes('/favourite-ports') && options.method !== 'GET'
        )
      ).toBe(false)
    }
  )

  test.each([
    [false, 'yes'],
    [false, 'no'],
    [true, 'yes'],
    [true, 'no']
  ])(
    'Should offer the same-port draft shortcut with favourites=%s and answer=%s (case 5)',
    async (favourites, answer) => {
      await seed()
      if (favourites) await seedFavourites({ favouritePortIds: ['port-2'] })
      const departure = await call('GET', '/departure-port')
      expect(departure.headers.location).toBe('/confirm-same-port?port=GBABC')
      const confirmation = await call('GET', departure.headers.location)
      expect(confirmation.statusCode).toBe(200)
      expect(load(confirmation.result)('h1').text()).toContain(
        'Was Test port the port or the closest port'
      )
      expect(load(confirmation.result)('.govuk-button')).toHaveLength(1)
      expect(
        (await call('POST', departure.headers.location, {})).statusCode
      ).toBe(400)
      const confirmed = await call('POST', departure.headers.location, {
        confirmSamePort: answer
      })
      expect(confirmed.statusCode).toBe(303)
      expect(confirmed.headers.location).toBe(
        answer === 'yes' ? '/gear-selection' : '/departure-port'
      )
      if (answer === 'no') {
        const next = await call('GET', '/departure-port')
        expect(next.statusCode).toBe(favourites ? 200 : 303)
        if (!favourites) {
          expect(next.headers.location).toBe('/add-port?for=departure&entry=1')
          const allPorts = await call('GET', next.headers.location)
          expect(load(allPorts.result)('input[name="port"]').val()).toBe(
            'Test port'
          )
        } else {
          expect(
            load(next.result)('input[value="GBABC"]').prop('checked')
          ).toBe(true)
        }
      }
      expect(getJourneyState(confirmed.request)).toMatchObject({
        departurePort: 'GBABC',
        returnPort: 'GBABC'
      })
      expect(
        fetchMock.mock.calls.every(([, options]) => options.method === 'GET')
      ).toBe(true)
    }
  )

  test.each([false, true])(
    'Should preselect both different draft ports with favourites=%s (case 6)',
    async (favourites) => {
      await seed({ ...recordJourney(record), returnPort: 'GBDEF' })
      if (favourites) await seedFavourites({ favouritePortIds: ['port-1'] })
      for (const [phase, code, name] of [
        ['departure', 'GBABC', 'Test port'],
        ['return', 'GBDEF', 'Second port']
      ]) {
        const screen = await call('GET', `/${phase}-port`)
        if (favourites) {
          expect(screen.statusCode).toBe(200)
          expect(
            load(screen.result)(`input[value="${code}"]`).prop('checked')
          ).toBe(true)
          expect(load(screen.result)('a.govuk-button--secondary')).toHaveLength(
            0
          )
        } else {
          expect(screen.statusCode).toBe(303)
          const search = await call('GET', screen.headers.location)
          expect(search.statusCode).toBe(200)
          expect(load(search.result)('input[name="port"]').val()).toBe(name)
        }
      }
      expect(
        fetchMock.mock.calls.every(([, options]) => options.method === 'GET')
      ).toBe(true)
    }
  )

  test.each([false, true])(
    'Should preselect a departure-only draft without a shortcut, favourites=%s',
    async (favourites) => {
      await seed({ ...recordJourney(record), returnPort: null })
      if (favourites) await seedFavourites({ favouritePortIds: ['port-2'] })
      const departure = await call('GET', '/departure-port')
      if (favourites) {
        expect(departure.statusCode).toBe(200)
        expect(
          load(departure.result)('input[value="GBABC"]').prop('checked')
        ).toBe(true)
      } else {
        expect(departure.headers.location).toBe(
          '/add-port?for=departure&entry=1'
        )
        const search = await call('GET', departure.headers.location)
        expect(load(search.result)('input[name="port"]').val()).toBe(
          'Test port'
        )
      }
      expect(
        fetchMock.mock.calls.every(([, options]) => options.method === 'GET')
      ).toBe(true)
    }
  )

  test('Should not use a previous trip or single favourite as a new record shortcut', async () => {
    await seed()
    await call('POST', '/records/new')
    await seed({
      ...recordJourney(record),
      departurePort: null,
      returnPort: null
    })
    await seedFavourites({ favouritePortIds: ['port-1'] })
    const departure = await call('GET', '/departure-port')
    expect(departure.statusCode).toBe(200)
    expect(load(departure.result)('input[value="GBABC"]').prop('checked')).toBe(
      false
    )
    const entry = await call('GET', '/add-port?for=departure&entry=1')
    expect(entry.statusCode).toBe(200)
    const fabricated = await call('POST', '/confirm-same-port?port=GBABC', {
      confirmSamePort: 'yes'
    })
    expect(fabricated.headers.location).toBe('/departure-port')
    expect(getJourneyState(fabricated.request).departurePort).toBeNull()
    expect(
      fetchMock.mock.calls.every(([, options]) => options.method === 'GET')
    ).toBe(true)
  })

  test.each(['departure', 'return'])(
    'Should select another %s port without changing favourites and preserve review return',
    async (phase) => {
      await seed({ ...recordJourney(record), returnPort: 'GBDEF' })
      await seedFavourites({ favouritePortIds: ['port-1'] })
      const screen = await call('GET', `/${phase}-port?return=/check-answers`)
      const href = `/add-port?for=${phase}&return=/check-answers`
      expect(load(screen.result)('a.govuk-button--secondary')).toHaveLength(0)
      const search = await call('GET', href)
      expect(load(search.result)('form').attr('action')).toBe(href)
      const saved = await call('POST', href, { port: 'Second port' })
      expect(saved.statusCode).toBe(303)
      expect(saved.headers.location).toBe('/check-answers')
      expect(getJourneyState(saved.request)).toMatchObject({
        [phase === 'departure' ? 'departurePort' : 'returnPort']: 'GBDEF',
        favouritePortIds: ['port-1'],
        favouritePorts: ['GBABC']
      })
      expect(
        fetchMock.mock.calls.filter(([, options]) => options.method !== 'GET')
      ).toHaveLength(1)
      expect(
        fetchMock.mock.calls.find(([, options]) => options.method !== 'GET')[1]
          .method
      ).toBe('PATCH')
    }
  )

  test('Should allow an already-favourite port in AllPorts without a duplicate error', async () => {
    await seed()
    await seedFavourites({ favouritePortIds: ['port-1'] })
    const selected = await call('POST', '/add-port?for=departure', {
      port: 'Test port'
    })
    expect(selected.statusCode).toBe(303)
    expect(selected.headers.location).toBe('/return-port')
    expect(getJourneyState(selected.request).favouritePortIds).toEqual([
      'port-1'
    ])
  })

  test.each(['departure', 'return'])(
    'Should not loop back to AllPorts from the %s search Back link',
    async (phase) => {
      await seed({
        ...recordJourney(record),
        departurePort: null,
        returnPort: null
      })
      const search = await call('GET', `/add-port?for=${phase}`)
      expect(search.statusCode).toBe(200)
      const back = load(search.result)(
        '[data-testid="app-page-navigation-back-link"]'
      ).attr('href')
      expect(back).toBe(
        phase === 'return' ? '/departure-port' : '/trip-return-date'
      )
    }
  )

  test('Should reject trip-only AllPorts saves without an active record', async () => {
    const response = await call('POST', '/add-port?for=departure&entry=1', {
      port: 'Test port'
    })
    expect(response.statusCode).toBe(400)
    expect(getJourneyState(response.request).favouritePortIds).toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test.each([409, 503])(
    'Should roll back AllPorts answers on backend failure %s',
    async (status) => {
      await seed({ ...recordJourney(record), returnPort: 'GBDEF' })
      await call('GET', '/add-port?for=departure')
      fetchMock.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ vesselId: 'vessel-1', favouritePortIds: [] })
      })
      fetchMock.mockResolvedValueOnce({ status })
      fetchMock.mockClear()
      const failed = await call('POST', '/add-port?for=departure', {
        port: 'Second port'
      })
      expect(failed.statusCode).toBe(status)
      expect(getJourneyState(failed.request)).toMatchObject({
        departurePort: 'GBABC',
        returnPort: 'GBDEF',
        catchRecordReloadRequired: true,
        favouritePortIds: []
      })
      expect(
        fetchMock.mock.calls.filter(([, options]) => options.method === 'PATCH')
      ).toHaveLength(1)
    }
  )

  test('Should not offer a removed previous port or replace an existing trip with its previous choice', async () => {
    await seed({
      catchRecordId: record.id,
      selectedVesselId: 'vessel-1',
      version: record.version,
      departurePort: 'GBABC'
    })
    await seedFavourites({ favouritePortIds: ['port-1', 'port-2'] })
    expect(
      (await call('POST', '/return-port', { returnPort: 'GBABC' })).statusCode
    ).toBe(303)
    const existing = await call('GET', '/departure-port')
    expect(existing.headers.location).toBe('/confirm-same-port?port=GBABC')
    await call('POST', '/remove-port', { ports: 'port-1' })
    await call('POST', '/records/new')
    await seed({ selectedVesselId: 'vessel-1' })
    const fresh = await call('GET', '/departure-port')
    expect(fresh.statusCode).toBe(200)
    expect(load(fresh.result)('input[value="GBABC"]')).toHaveLength(0)
    expect(load(fresh.result)('input[value="GBDEF"]')).toHaveLength(1)
  })

  test('Should not offer same-port confirmation after a trip using different departure and return ports', async () => {
    await seed({
      catchRecordId: record.id,
      selectedVesselId: 'vessel-1',
      version: record.version,
      departurePort: 'GBABC'
    })
    await seedFavourites({ favouritePortIds: ['port-1', 'port-2'] })
    expect(
      (await call('POST', '/return-port', { returnPort: 'GBABC' })).statusCode
    ).toBe(303)
    expect(
      (await call('POST', '/return-port', { returnPort: 'GBDEF' })).statusCode
    ).toBe(303)
    await call('POST', '/records/new')
    await seed({ selectedVesselId: 'vessel-1' })
    expect((await call('GET', '/departure-port')).statusCode).toBe(200)
  })

  test.each(['/departure-port', '/add-port?for=departure&entry=1'])(
    'Should show same-draft port confirmation instead of first-time entry on %s',
    async (path) => {
      await seed({
        ...recordJourney(record),
        departurePort: 'GBDEF',
        returnPort: 'GBDEF'
      })
      await seedFavourites({ favouritePortIds: ['port-2'] })
      const response = await call('GET', path)
      expect(response.statusCode).toBe(303)
      expect(response.headers.location).toBe('/confirm-same-port?port=GBDEF')
      const confirmation = await call('GET', response.headers.location)
      expect(confirmation.statusCode).toBe(200)
      expect(load(confirmation.result)('h1').text()).toContain(
        'Was Second port the port or the closest port you set off from and returned to?'
      )
      expect(load(confirmation.result)('.govuk-button')).toHaveLength(1)
    }
  )

  test('Should require a vessel for favourite writes and offer only that vessel favourites to trips', async () => {
    await call('POST', '/sign-in')
    for (const [path, payload] of [
      ['/add-port?return=/account', { port: 'Second port' }],
      ['/add-species?return=/account', { species: 'Haddock' }],
      ['/add-gear?return=/account', { gear: 'Recreational gear' }]
    ]) {
      const response = await call('POST', path, payload)
      expect(response.statusCode).toBe(400)
      expect(response.request.yar.get('journey')?.catchRecordId).toBeUndefined()
      const saved = await call('POST', `${path}&vesselId=vessel-1`, payload)
      expect(saved.statusCode).toBe(303)
      expect(saved.headers.location).toBe('/account')
    }
    const account = await call('GET', '/account')
    expect(account.statusCode).toBe(200)
    for (const value of ['Second port', 'Haddock', 'Recreational gear']) {
      expect(account.result).toContain(value)
    }
    expect(account.result).not.toContain('Hastings')
    await seed({ selectedVesselId: 'vessel-1' })
    const gears = await call('GET', '/gear-selection')
    expect(getJourneyState(gears.request)).toMatchObject({
      favouriteGearIds: ['gear-2'],
      favouriteSpeciesIds: ['species-2'],
      favouritePortIds: ['port-2']
    })
    const ports = await call('GET', '/departure-port')
    expect(load(ports.result)('input[value="GBDEF"]')).toHaveLength(1)
    const species = await call('GET', '/species-selection')
    expect(load(species.result)('input[value="species-2"]')).toHaveLength(1)
    await seed({ selectedVesselId: 'vessel-2' })
    const second = await call('GET', '/gear-selection')
    expect(getJourneyState(second.request).favouriteGearIds).toEqual([])
    expect((await call('GET', '/departure-port')).statusCode).toBe(303)
    expect(
      load((await call('GET', '/species-selection')).result)(
        'input[value="species-2"]'
      )
    ).toHaveLength(0)
    expect(record).toEqual(canonicalCatchRecord())
    expect(
      fetchMock.mock.calls.some(
        ([url, options]) =>
          url.includes('/catch-records') && options.method !== 'GET'
      )
    ).toBe(false)
  })

  test('Should retain vessel favourites when starting and resuming records without adopting trip selections', async () => {
    const preferences = {
      favouriteGearIds: ['gear-2'],
      favouriteGearMeasurements: {},
      favouriteSpeciesIds: ['species-2'],
      favouritePortIds: ['port-2']
    }
    await seedFavourites(preferences)
    await seed()
    const started = await call('POST', '/records/new')
    expect(started.statusCode).toBe(303)
    expect(started.headers.location).toBe('/select-vessel')
    expect(started.request.yar.get('journey')).toEqual({})
    expect(
      started.request.yar.get('vesselFavourites')['vessel-1']
    ).toMatchObject(preferences)
    expect(getJourneyState(started.request).favouriteGearIds).toBeUndefined()
    const actionKey = await openRecord()
    const resumed = await call('POST', `/records/${record.id}/resume`, {
      actionKey
    })
    expect(resumed.statusCode).toBe(303)
    expect(getJourneyState(resumed.request)).toMatchObject({
      ...preferences,
      selectedGearIds: ['gear-1'],
      catchDetailsByGearId: recordJourney(record).catchDetailsByGearId
    })
    const ports = await call('GET', '/departure-port')
    expect(getJourneyState(ports.request)).toMatchObject({
      favouritePortIds: ['port-2'],
      favouritePorts: ['GBDEF'],
      departurePort: 'GBABC'
    })
    expect(
      fetchMock.mock.calls.every(([, options]) => options.method === 'GET')
    ).toBe(true)
  })

  test('Should keep journey gear, measurements, species and ports out of favourites', async () => {
    await seed({
      ...recordJourney(record),
      selectedGearIds: [],
      catchDetailsByGearId: {},
      gearMeasurementDetails: {},
      departurePort: null,
      returnPort: null
    })
    const preferences = {
      favouriteGearIds: [],
      favouriteGearMeasurements: {},
      favouriteSpeciesIds: ['species-2'],
      favouritePortIds: ['port-2']
    }
    await seedFavourites(preferences)
    const search = await call('GET', '/add-gear')
    expect(load(search.result)('h1').text()).toContain('What gear did you use?')
    expect(load(search.result)('.govuk-caption-l').text()).toBe(
      record.catchRecordReference
    )
    expect(
      (await call('POST', '/add-gear', { gear: 'Test gear' })).statusCode
    ).toBe(303)
    const invalid = await call('POST', '/add-gear?step=measurements', {
      'measurement-1': '-1'
    })
    expect(invalid.statusCode).toBe(400)
    expect(getJourneyState(invalid.request).journeyGearIds).toBeUndefined()
    const added = await call('POST', '/add-gear?step=measurements', {
      'measurement-1': '12'
    })
    expect(added.statusCode).toBe(303)
    expect(getJourneyState(added.request)).toMatchObject({
      ...preferences,
      journeyGearIds: ['gear-1'],
      gearMeasurementDetails: { 'gear-1': { 'measurement-1': 12 } }
    })
    const choices = await call('GET', '/gear-selection')
    expect(load(choices.result)('input[value="gear-1"]')).toHaveLength(1)
    expect(
      load(choices.result)('input[name="gear-1-measurement-1"]').val()
    ).toBe('12')
    const badGear = await call('POST', '/gear-selection', {
      gearIds: 'gear-1',
      'gear-1-measurement-1': '-1'
    })
    expect(badGear.statusCode).toBe(400)
    expect(load(badGear.result)('input[value="gear-1"]')).toHaveLength(1)
    expect(
      (
        await call('POST', '/gear-selection', {
          gearIds: 'gear-1',
          'gear-1-measurement-1': '12'
        })
      ).statusCode
    ).toBe(303)
    const speciesPath = '/add-species?gearId=gear-1'
    const speciesSearch = await call('GET', speciesPath)
    expect(load(speciesSearch.result)('h1').text()).toContain(
      'Add species to your catch record'
    )
    const species = await call('POST', speciesPath, { species: 'Cod' })
    expect(species.statusCode).toBe(303)
    expect(getJourneyState(species.request)).toMatchObject({
      ...preferences,
      journeySpeciesIds: ['species-1']
    })
    const speciesChoices = await call('GET', '/species-selection?gearId=gear-1')
    expect(
      load(speciesChoices.result)('input[value="species-1"]')
    ).toHaveLength(1)
    expect(
      load(speciesChoices.result)('input[value="species-2"]')
    ).toHaveLength(1)
    expect(
      (await call('POST', speciesPath, { species: 'Cod' })).statusCode
    ).toBe(400)
    const port = await call('POST', '/add-port?for=departure', {
      port: 'Test port'
    })
    expect(port.statusCode).toBe(303)
    expect(getJourneyState(port.request)).toMatchObject({
      ...preferences,
      departurePort: 'GBABC'
    })
    await call('POST', '/sign-in')
    const account = await call('GET', '/account')
    const $account = load(account.result)
    const accountRows = $account('.govuk-summary-list__row')
    const accountValue = (label) =>
      accountRows
        .filter((_, item) => $account(item).find('dt').text().trim() === label)
        .find('.govuk-summary-list__value')
        .text()
    expect(accountValue('Gear onboard')).not.toContain('Test gear')
    expect(accountValue('Species caught')).toContain('Haddock')
    expect(accountValue('Species caught')).not.toContain('Cod')
    expect(accountValue('Ports used')).toContain('Second port')
    expect(accountValue('Ports used')).not.toContain('Test port')
    const fresh = await call('POST', '/records/new')
    expect(fresh.request.yar.get('vesselFavourites')['vessel-1']).toMatchObject(
      preferences
    )
    expect(getJourneyState(fresh.request).journeyGearIds).toBeUndefined()
    expect(getJourneyState(fresh.request).journeySpeciesIds).toBeUndefined()
  })

  test('Should add unmeasured journey gear without adding a favourite and retain choices across validation', async () => {
    await seed({ ...recordJourney(record), selectedGearIds: [] })
    const added = await call('POST', '/add-gear', { gear: 'Recreational gear' })
    expect(added.statusCode).toBe(303)
    expect(getJourneyState(added.request)).toMatchObject({
      journeyGearIds: ['gear-2'],
      favouriteGearIds: []
    })
    expect((await call('GET', '/gear-selection')).result).toContain(
      'Recreational gear'
    )
    expect(
      (await call('POST', '/add-gear', { gear: 'Recreational gear' }))
        .statusCode
    ).toBe(400)
    expect(
      fetchMock.mock.calls.every(([, options]) => options.method === 'GET')
    ).toBe(true)
  })

  test('Should keep explicit account favourites actions working while a catch record is open', async () => {
    await seed()
    for (const [path, payload] of [
      ['/add-gear?return=/account', { gear: 'Recreational gear' }],
      ['/add-species?return=/account', { species: 'Haddock' }],
      ['/add-port?return=/account', { port: 'Second port' }]
    ]) {
      const saved = await call('POST', path, payload)
      expect(saved.statusCode).toBe(303)
      expect(saved.headers.location).toBe('/account')
    }
    const trip = await call('GET', '/gear-selection')
    expect(getJourneyState(trip.request)).toMatchObject({
      favouriteGearIds: ['gear-2'],
      favouriteSpeciesIds: ['species-2'],
      favouritePortIds: ['port-2']
    })
  })

  test('Should retain favourite measurement defaults when using different trip measurements', async () => {
    await seed({
      ...recordJourney(record),
      selectedGearIds: [],
      catchDetailsByGearId: {},
      gearMeasurementDetails: {}
    })
    await seedFavourites({
      favouriteGearIds: ['gear-1'],
      favouriteGearMeasurements: { 'gear-1': { 'measurement-1': 5 } },
      favouriteSpeciesIds: ['species-1']
    })
    expect(
      (await call('POST', '/add-gear', { gear: 'Test gear' })).statusCode
    ).toBe(303)
    const saved = await call('POST', '/add-gear?step=measurements', {
      'measurement-1': '12'
    })
    expect(saved.statusCode).toBe(303)
    expect(getJourneyState(saved.request)).toMatchObject({
      gearMeasurementDetails: { 'gear-1': { 'measurement-1': 12 } },
      favouriteGearMeasurements: { 'gear-1': { 'measurement-1': 5 } },
      favouriteGearIds: ['gear-1']
    })
    expect(
      (
        await call('POST', '/gear-selection', {
          gearIds: 'gear-1',
          'gear-1-measurement-1': '12'
        })
      ).statusCode
    ).toBe(303)
    const species = await call(
      'POST',
      '/add-species?gearId=gear-1&return=/check-answers',
      { species: 'Cod' }
    )
    expect(species.statusCode).toBe(303)
    expect(species.headers.location).toContain('/species-selection')
    expect(species.headers.location).toContain('gearId=gear-1')
    expect(
      new URL(species.headers.location, 'http://localhost').searchParams.get(
        'return'
      )
    ).toBe('/check-answers')
    expect(getJourneyState(species.request).favouriteSpeciesIds).toEqual([
      'species-1'
    ])
  })

  test('Should not convert pending trip gear measurements into favourite defaults via an account form', async () => {
    await seed({ ...recordJourney(record), selectedGearIds: [] })
    await call('POST', '/add-gear', { gear: 'Test gear' })
    const wrongContext = await call(
      'POST',
      '/add-gear?return=/account&step=measurements',
      { 'measurement-1': '12' }
    )
    expect(wrongContext.statusCode).toBe(400)
    expect(getJourneyState(wrongContext.request).favouriteGearIds).toEqual([])
    expect(
      getJourneyState(wrongContext.request).favouriteGearMeasurements
    ).toEqual({})
    const trip = await call('POST', '/add-gear?step=measurements', {
      'measurement-1': '12'
    })
    expect(trip.statusCode).toBe(303)
    expect(getJourneyState(trip.request).journeyGearIds).toEqual(['gear-1'])
    expect(getJourneyState(trip.request).favouriteGearIds).toEqual([])
  })

  test('Should prefill account favourite measurements when selecting gear on a new journey', async () => {
    const path = '/add-gear?return=/account&vesselId=vessel-1'
    await call('POST', path, { gear: 'Test gear' })
    const saved = await call('POST', `${path}&step=measurements`, {
      'measurement-1': '12'
    })
    expect(saved.statusCode).toBe(303)
    await call('POST', '/records/new')
    const selected = await call('POST', '/select-vessel', {
      vesselId: 'vessel-1'
    })
    expect(selected.statusCode).toBe(303)
    await seed({
      ...getJourneyState(selected.request),
      gearMeasurementDetails: { 'gear-1': {} }
    })
    const choices = await call('GET', '/gear-selection')
    expect(choices.statusCode).toBe(200)
    expect(
      load(choices.result)('input[name="gear-1-measurement-1"]').val()
    ).toBe('12')
    const submitted = await call('POST', '/gear-selection', {
      gearIds: 'gear-1',
      'gear-1-measurement-1': '12'
    })
    expect(submitted.statusCode).toBe(303)
    expect(
      getJourneyState(submitted.request).gearMeasurementDetails['gear-1']
    ).toEqual({ 'measurement-1': 12 })
    const back = await call('GET', '/gear-selection')
    expect(load(back.result)('input[name="gear-1-measurement-1"]').val()).toBe(
      '12'
    )
    await seed({
      ...getJourneyState(back.request),
      gearMeasurementDetails: { 'gear-1': { 'measurement-1': 0 } }
    })
    const zero = await call('GET', '/gear-selection')
    expect(load(zero.result)('input[name="gear-1-measurement-1"]').val()).toBe(
      '0'
    )
    await seed({
      ...getJourneyState(zero.request),
      gearMeasurementDetails: { 'gear-1': { 'measurement-1': '' } }
    })
    const cleared = await call('GET', '/gear-selection')
    expect(
      load(cleared.result)('input[name="gear-1-measurement-1"]').val()
    ).toBe('')
  })

  test('Should save gear measurements only after validation and isolate them when changing vessels', async () => {
    const path = '/add-gear?return=/account&vesselId=vessel-1'
    await call('POST', path, { gear: 'Test gear' })
    const invalid = await call('POST', `${path}&step=measurements`, {
      'measurement-1': '-1'
    })
    expect(invalid.statusCode).toBe(400)
    expect(getJourneyState(invalid.request).favouriteGearIds).toEqual([])
    const saved = await call('POST', `${path}&step=measurements`, {
      'measurement-1': '12'
    })
    expect(saved.statusCode).toBe(303)
    await seed({ selectedVesselId: 'vessel-2' })
    const selection = await call('GET', '/gear-selection')
    expect(getJourneyState(selection.request)).toMatchObject({
      favouriteGearIds: [],
      favouriteGearMeasurements: {}
    })
    await seed({ selectedVesselId: 'vessel-1' })
    expect(
      getJourneyState((await call('GET', '/gear-selection')).request)
    ).toMatchObject({
      favouriteGearIds: ['gear-1'],
      favouriteGearMeasurements: { 'gear-1': { 'measurement-1': 12 } }
    })
    expect(
      fetchMock.mock.calls.filter(([, options]) => options.method === 'POST')
    ).toHaveLength(1)
  })

  test('Should remove favourites without changing selected trip answers or catch records', async () => {
    await seed()
    await seedFavourites({
      favouriteGearIds: ['gear-1'],
      favouriteGearMeasurements: { 'gear-1': { 'measurement-1': 12 } },
      favouriteSpeciesIds: ['species-1'],
      favouritePortIds: ['port-1']
    })
    const before = structuredClone(record)
    for (const [path, payload] of [
      ['/remove-gear', { gearIds: 'gear-1' }],
      ['/remove-species', { speciesIds: 'species-1' }],
      ['/remove-port', { ports: 'port-1' }]
    ]) {
      expect((await call('POST', path, payload)).statusCode).toBe(303)
    }
    const selection = await call('GET', '/gear-selection')
    expect(getJourneyState(selection.request)).toMatchObject({
      selectedGearIds: ['gear-1'],
      favouriteGearIds: [],
      favouriteGearMeasurements: {},
      favouriteSpeciesIds: [],
      favouritePortIds: [],
      departurePort: 'GBABC',
      returnPort: 'GBABC',
      catchDetailsByGearId: recordJourney(before).catchDetailsByGearId
    })
    expect(
      load(selection.result)('input[name="gearIds"][value="gear-1"]').prop(
        'checked'
      )
    ).toBe(true)
    expect(record).toEqual(before)
    expect(
      fetchMock.mock.calls.filter(([, options]) => options.method === 'DELETE')
    ).toHaveLength(3)
    expect(
      fetchMock.mock.calls.some(
        ([url, options]) =>
          url.includes('/catch-records') && options.method !== 'GET'
      )
    ).toBe(false)
  })

  test('Should retain backend favourites across sign-out and fresh browser sessions', async () => {
    await call('POST', '/sign-in')
    await call('POST', '/add-port?return=/account&vesselId=vessel-1', {
      port: 'Second port'
    })
    const firstCookie = cookie
    cookie = undefined
    const fresh = await call('GET', '/remove-port?vesselId=vessel-1')
    expect(getJourneyState(fresh.request).favouritePortIds).toEqual(['port-2'])
    cookie = firstCookie
    expect(
      getJourneyState(
        (await call('GET', '/remove-port?vesselId=vessel-1')).request
      ).favouritePortIds
    ).toEqual(['port-2'])
    await call('POST', '/sign-out')
    await call('POST', '/sign-in')
    const cleared = await call('GET', '/account')
    expect(
      cleared.request.yar.get('vesselFavourites')['vessel-1']
    ).toMatchObject({
      favouriteGearIds: [],
      favouriteSpeciesIds: [],
      favouritePortIds: ['port-2']
    })
    expect(
      fetchMock.mock.calls.filter(([, options]) => options.method === 'POST')
    ).toHaveLength(1)
  })

  test.each([
    ['/add-port', { port: 'Unknown port' }],
    ['/add-species', { species: 'Unknown species' }],
    ['/add-gear', { gear: 'Unknown gear' }]
  ])(
    'Should validate %s against reference catalogues without backend profile writes',
    async (path, payload) => {
      const response = await call('POST', path, payload)
      expect(response.statusCode).toBe(400)
      expect(fetchMock).not.toHaveBeenCalled()
    }
  )

  test('Should reject duplicate port additions without changing saved IDs', async () => {
    const path = '/add-port?return=/account&vesselId=vessel-1'
    await call('POST', path, { port: 'Second port' })
    const duplicate = await call('POST', path, { port: 'Second port' })
    expect(duplicate.statusCode).toBe(400)
    expect(getJourneyState(duplicate.request).favouritePortIds).toEqual([
      'port-2'
    ])
    expect(
      fetchMock.mock.calls.filter(([, options]) => options.method === 'POST')
    ).toHaveLength(1)
  })

  test.each([
    [{ favouriteSpeciesIds: ['retired'] }, '/remove-species'],
    [{ favouritePortIds: ['retired'] }, '/remove-port']
  ])(
    'Should report unavailable reference favourites rather than silently dropping them',
    async (preferences, path) => {
      await seed({ selectedVesselId: 'vessel-1' })
      await seedFavourites(preferences)
      expect((await call('GET', path)).statusCode).toBe(409)
    }
  )

  test('Should save a skipper only at confirmation and load it on account in a fresh session', async () => {
    await call('POST', '/sign-in')
    await seed()
    const savedRecord = structuredClone(record)
    const decision = await call('GET', '/add-skipper')
    expect(load(decision.result)('h1').text()).toContain('TEST VESSEL')
    await call('POST', '/add-skipper', { wantsToAddSkipper: 'yes' })
    const details = await call('POST', '/skipper-details', {
      firstName: 'Test',
      lastName: 'Skipper',
      email: 'skipper@example.com',
      phoneNumber: '+44 123456789'
    })
    expect(details.statusCode).toBe(303)
    expect(vesselSkippers['vessel-1']).toBeUndefined()
    const review = await call('GET', '/skipper-check')
    expect(review.statusCode).toBe(200)
    expect(review.result).toContain('+44 123456789')
    const saved = await call('POST', '/skipper-check', {
      confirmSkipper: 'true'
    })
    expect(saved.statusCode).toBe(303)
    expect(saved.headers.location).toBe('/skipper-confirmation')
    expect(vesselSkippers['vessel-1']).toEqual([
      {
        id: 'skipper-1',
        name: 'Test Skipper',
        email: 'skipper@example.com',
        phoneNumber: '+44 123456789'
      }
    ])
    const addition = fetchMock.mock.calls.find(
      ([url, options]) => url.endsWith('/skippers') && options.method === 'POST'
    )
    expect(addition[1].headers['Idempotency-Key']).toBe(
      getJourneyState(details.request).skipperAdditionKey
    )
    expect(addition[1].headers['If-Match']).toBeUndefined()
    const confirmation = await call('GET', '/skipper-confirmation')
    expect(confirmation.result).toContain(
      'Skipper added for vessel TEST VESSEL'
    )
    expect(confirmation.result).toContain('does not send an invitation')
    expect(confirmation.result).not.toContain('We’ve sent')
    await call('POST', '/skipper-check', { confirmSkipper: 'true' })
    expect(
      fetchMock.mock.calls.filter(
        ([url, options]) =>
          url.endsWith('/skippers') && options.method === 'POST'
      )
    ).toHaveLength(1)
    cookie = undefined
    await call('POST', '/sign-in')
    await seed()
    const account = await call('GET', '/account')
    expect(account.statusCode).toBe(200)
    expect(account.result).toContain('Test Skipper')
    expect(
      load(account.result)('a[href="/remove-skipper?vesselId=vessel-1"]')
    ).toHaveLength(1)
    expect(record).toEqual(savedRecord)
    expect(
      fetchMock.mock.calls.some(([, options]) => options.method === 'PATCH')
    ).toBe(false)
  })

  test('Should save a skipper without optional contacts', async () => {
    await seed()
    const details = await call('POST', '/skipper-details', {
      firstName: 'Test',
      lastName: 'Skipper'
    })
    expect(details.statusCode).toBe(303)
    const saved = await call('POST', '/skipper-check', {
      confirmSkipper: 'true'
    })
    expect(saved.statusCode).toBe(303)
    expect(vesselSkippers['vessel-1']).toEqual([
      { id: 'skipper-1', name: 'Test Skipper' }
    ])
  })

  test('Should keep pending skipper details off the account until confirmed', async () => {
    await call('POST', '/sign-in')
    await seed()
    await call('POST', '/skipper-details', {
      firstName: 'Pending',
      lastName: 'Skipper'
    })
    const account = await call('GET', '/account')
    expect(account.statusCode).toBe(200)
    expect(account.result).not.toContain('Pending Skipper')
    expect(
      account.request.yar.get('accountJourney:vessel-1').vesselSkippers
    ).toEqual([])
    const invalid = await call('POST', '/skipper-check', {})
    expect(invalid.statusCode).toBe(400)
    expect(
      fetchMock.mock.calls.some(([, options]) => options.method === 'POST')
    ).toBe(false)
  })

  test('Should require pending details before skipper submission', async () => {
    await seed()
    const response = await call('POST', '/skipper-check', {
      confirmSkipper: 'true'
    })
    expect(response.statusCode).toBe(400)
    expect(response.result).toContain(
      'Enter skipper details for the selected vessel first'
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('Should preserve the add key for unchanged details and rotate it for changed details', async () => {
    await seed()
    const details = { firstName: 'Test', lastName: 'Skipper' }
    const first = await call('POST', '/skipper-details', details)
    const key = getJourneyState(first.request).skipperAdditionKey
    const same = await call('POST', '/skipper-details', details)
    expect(getJourneyState(same.request).skipperAdditionKey).toBe(key)
    const changed = await call('POST', '/skipper-details', {
      ...details,
      phoneNumber: '12345'
    })
    expect(getJourneyState(changed.request).skipperAdditionKey).not.toBe(key)
    await call('POST', '/add-skipper', { wantsToAddSkipper: 'yes' })
    const newDetails = await call('GET', '/skipper-details')
    expect(getJourneyState(newDetails.request)).toMatchObject({
      pendingSkipper: null,
      skipperAdditionKey: null,
      skipperConfirmed: false
    })
  })

  test.each([
    undefined,
    { firstName: '', lastName: 'Skipper' },
    { firstName: 'A'.repeat(50), lastName: 'B'.repeat(50) },
    { firstName: 'Test', lastName: 'Skipper', phoneNumber: '1'.repeat(31) },
    { firstName: 'Test', lastName: 'Skipper', email: 'invalid' },
    { firstName: ['Test'], lastName: 'Skipper' }
  ])(
    'Should validate skipper details before API writes %j',
    async (payload) => {
      await seed()
      const response = await call('POST', '/skipper-details', payload)
      expect(response.statusCode).toBe(400)
      expect(load(response.result)('.govuk-error-summary').text()).toContain(
        'There is a problem'
      )
      expect(fetchMock).not.toHaveBeenCalled()
    }
  )

  test('Should allow exactly 100 characters for the combined skipper name', async () => {
    await seed()
    const response = await call('POST', '/skipper-details', {
      firstName: 'A'.repeat(49),
      lastName: 'B'.repeat(50)
    })
    expect(response.statusCode).toBe(303)
    const saved = await call('POST', '/skipper-check', {
      confirmSkipper: 'true'
    })
    expect(saved.statusCode).toBe(303)
    expect(vesselSkippers['vessel-1'][0].name).toHaveLength(100)
  })

  test.each([409, 503])(
    'Should retain pending details and the idempotency key after skipper save failure %s',
    async (status) => {
      await seed()
      const details = await call('POST', '/skipper-details', {
        firstName: 'Test',
        lastName: 'Skipper'
      })
      const key = getJourneyState(details.request).skipperAdditionKey
      const upstream = fetchMock.getMockImplementation()
      let rejectNextPost = true
      fetchMock.mockImplementation((url, options) => {
        if (
          rejectNextPost &&
          options.method === 'POST' &&
          url.endsWith('/skippers')
        ) {
          rejectNextPost = false
          return Promise.resolve({ status })
        }
        return upstream(url, options)
      })
      const failed = await call('POST', '/skipper-check', {
        confirmSkipper: 'true'
      })
      expect(failed.statusCode).toBe(status)
      expect(getJourneyState(failed.request)).toMatchObject({
        skipperAdditionKey: key,
        skipperConfirmed: false,
        pendingSkipper: { firstName: 'Test', lastName: 'Skipper' }
      })
      expect(getJourneyState(failed.request).vesselSkippers).toBeUndefined()
      const confirmation = await call('GET', '/skipper-confirmation')
      expect(confirmation.headers.location).toBe('/add-skipper')
      fetchMock.mockImplementation(upstream)
      const retry = await call('POST', '/skipper-check', {
        confirmSkipper: 'true'
      })
      expect(retry.statusCode).toBe(303)
      const posts = fetchMock.mock.calls.filter(
        ([, options]) => options.method === 'POST'
      )
      expect(
        posts.map(([, options]) => options.headers['Idempotency-Key'])
      ).toEqual([key, key])
    }
  )

  test('Should scope pending skipper details and saved lists to the selected vessel', async () => {
    await seed({
      selectedVesselId: 'vessel-2',
      pendingSkipper: { firstName: 'Previous', lastName: 'Skipper' },
      pendingSkipperVesselId: 'vessel-1',
      skipperAdditionKey: 'old-key',
      skipperConfirmed: true,
      skipperConfirmedVesselId: 'vessel-1',
      skippersVesselId: 'vessel-1',
      vesselSkippers: [{ id: 'old-id', name: 'Previous Skipper' }]
    })
    const details = await call('GET', '/skipper-details')
    expect(details.statusCode, load(details.result)('main').text()).toBe(200)
    expect(load(details.result)('input[name="firstName"]').val() || '').toBe('')
    const blocked = await call('POST', '/skipper-check', {
      confirmSkipper: 'true'
    })
    expect(blocked.statusCode).toBe(400)
    const removal = await call('GET', '/remove-skipper')
    expect(removal.statusCode).toBe(200)
    expect(removal.result).toContain('There are no saved skippers')
    expect(removal.result).not.toContain('Previous Skipper')
    expect(getJourneyState(removal.request)).toMatchObject({
      skippersVesselId: 'vessel-2',
      vesselSkippers: []
    })
  })

  test('Should remove saved skippers by ID without changing the catch record', async () => {
    await seed()
    const savedRecord = structuredClone(record)
    vesselSkippers['vessel-1'] = [
      { id: 'skipper-1', name: 'First Skipper' },
      { id: 'skipper-2', name: 'Second Skipper' }
    ]
    const page = await call('GET', '/remove-skipper')
    expect(page.statusCode).toBe(200)
    expect(
      load(page.result)('input[name="skipperIds"][value="skipper-1"]')
    ).toHaveLength(1)
    const removed = await call('POST', '/remove-skipper', {
      skipperIds: ['skipper-1', 'skipper-1']
    })
    expect(removed.statusCode).toBe(303)
    expect(removed.headers.location).toBe('/account')
    expect(vesselSkippers['vessel-1']).toEqual([
      { id: 'skipper-2', name: 'Second Skipper' }
    ])
    expect(getJourneyState(removed.request).vesselSkippers).toEqual(
      vesselSkippers['vessel-1']
    )
    expect(record).toEqual(savedRecord)
    expect(
      fetchMock.mock.calls.filter(([, options]) => options.method === 'DELETE')
    ).toHaveLength(1)
    expect(
      fetchMock.mock.calls.some(([, options]) => options.method === 'PATCH')
    ).toBe(false)
  })

  test('Should keep successful skipper deletions when a later removal fails', async () => {
    await seed()
    vesselSkippers['vessel-1'] = [
      { id: 'skipper-1', name: 'First Skipper' },
      { id: 'skipper-2', name: 'Second Skipper' }
    ]
    const upstream = fetchMock.getMockImplementation()
    fetchMock.mockImplementation((url, options) =>
      url.endsWith('/skippers/skipper-2') && options.method === 'DELETE'
        ? Promise.resolve({ status: 503 })
        : upstream(url, options)
    )
    const response = await call('POST', '/remove-skipper', {
      skipperIds: ['skipper-1', 'skipper-2']
    })
    expect(response.statusCode).toBe(503)
    expect(getJourneyState(response.request).vesselSkippers).toEqual([
      { id: 'skipper-2', name: 'Second Skipper' }
    ])
    expect(vesselSkippers['vessel-1']).toEqual([
      { id: 'skipper-2', name: 'Second Skipper' }
    ])
  })

  test.each([undefined, 'unknown-id'])(
    'Should reject missing or unknown skipper removal selections %s',
    async (skipperIds) => {
      await seed()
      vesselSkippers['vessel-1'] = [{ id: 'skipper-1', name: 'First Skipper' }]
      const response = await call('POST', '/remove-skipper', { skipperIds })
      expect(response.statusCode).toBe(400)
      expect(
        fetchMock.mock.calls.some(([, options]) => options.method === 'DELETE')
      ).toBe(false)
    }
  )

  test.each([
    '/add-skipper',
    '/skipper-details',
    '/skipper-check',
    '/skipper-confirmation',
    '/remove-skipper'
  ])(
    'Should require a selected vessel for live skipper page %s',
    async (path) => {
      await seed({})
      const response = await call('GET', path)
      expect(response.statusCode).toBe(400)
      expect(fetchMock).not.toHaveBeenCalled()
    }
  )

  test.each([403, 503])(
    'Should surface skipper lookup failure %s without session fallbacks',
    async (status) => {
      await seed({
        ...recordJourney(record),
        vesselSkippers: [{ id: 'old', name: 'Stale Skipper' }]
      })
      fetchMock.mockResolvedValue({ status })
      const response = await call('GET', '/remove-skipper')
      expect(response.statusCode).toBe(status)
      expect(response.result).not.toContain('Stale Skipper')
    }
  )

  test('Should not expose skipper removal in walkthrough mode', async () => {
    config.set('catchRecording.enabled', false)
    const response = await call('GET', '/remove-skipper')
    expect(response.statusCode).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('Should PATCH gear measurements, resolving area codes to API feature IDs', async () => {
    await seed()
    const response = await call('POST', '/gear-selection', {
      gearIds: 'gear-1',
      'gear-1-measurement-1': '15'
    })
    expect(response.statusCode).toBe(303)
    const options = fetchMock.mock.calls.find(
      ([, options]) => options.method === 'PATCH'
    )[1]
    expect(JSON.parse(options.body)).toMatchObject({
      section: 'gears',
      data: [
        {
          associationId: record.gears[0].associationId,
          gear: { id: 'gear-1' },
          characteristics: [{ characteristicId: 'measurement-1', value: 15 }],
          statisticalArea: { id: 'area-1' }
        }
      ]
    })
  })

  test('Should let the backend generate new gear association IDs and reuse them on later saves', async () => {
    record.gears = []
    await seed({ ...recordJourney(record), favouriteGearIds: ['gear-1'] })
    const first = await call('POST', '/gear-selection', {
      gearIds: 'gear-1',
      'gear-1-measurement-1': '15'
    })
    expect(first.statusCode).toBe(303)
    const firstPatch = fetchMock.mock.calls.find(
      ([, options]) => options.method === 'PATCH'
    )[1]
    expect(JSON.parse(firstPatch.body).data[0]).not.toHaveProperty(
      'associationId'
    )
    expect(getJourneyState(first.request).gearAssociationIds).toEqual({
      'gear-1': '00000000-0000-4000-8000-000000000222'
    })
    const second = await call('POST', '/gear-selection', {
      gearIds: 'gear-1',
      'gear-1-measurement-1': '16'
    })
    expect(second.statusCode).toBe(303)
    const patches = fetchMock.mock.calls.filter(
      ([, options]) => options.method === 'PATCH'
    )
    expect(JSON.parse(patches[1][1].body).data[0].associationId).toBe(
      '00000000-0000-4000-8000-000000000222'
    )
  })

  test('Should stage partial trip answers until both dates and ports are available', async () => {
    await seed({
      catchRecordId: record.id,
      selectedVesselId: 'vessel-1',
      reference: record.catchRecordReference,
      version: 5
    })
    const staged = await call('POST', '/trip-date', { tripSameDate: 'no' })
    expect(staged.statusCode).toBe(303)
    expect(getJourneyState(staged.request).catchRecordPendingTrip).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
    const blocked = await call('POST', '/check-answers', {})
    expect(blocked.statusCode).toBe(400)
    await seed({
      ...getJourneyState(staged.request),
      departureDate: '2026-06-01',
      returnDate: '2026-06-02',
      departurePort: 'GBABC'
    })
    const completed = await call('POST', '/return-port', {
      returnPort: 'GBABC'
    })
    expect(completed.statusCode).toBe(303)
    expect(getJourneyState(completed.request)).toMatchObject({
      version: 6,
      catchRecordPendingTrip: false
    })
    expect(
      fetchMock.mock.calls.filter(([, options]) => options.method === 'PATCH')
    ).toHaveLength(1)
  })

  test('Should PUT all client-owned answers before submitting with the replacement version', async () => {
    record.pairFishing = {
      enabled: true,
      pairVessel: 'OTHER VESSEL',
      pairSkipperName: 'Test skipper'
    }
    await seed({
      ...recordJourney(record),
      submissionKey: 'review-key',
      submissionVersion: 5
    })
    const response = await call('POST', '/check-answers', {
      submissionKey: 'review-key'
    })
    expect(response.statusCode).toBe(303)
    const [, options] = fetchMock.mock.calls.find(
      ([, options]) => options.method === 'PUT'
    )
    const payload = JSON.parse(options.body)
    expect(Object.keys(payload).sort()).toEqual([
      'gears',
      'pairFishing',
      'speciesNotLanded',
      'trip',
      'vessel'
    ])
    expect(payload).toMatchObject({
      vessel: { id: 'vessel-1' },
      pairFishing: {
        enabled: true,
        pairVessel: 'OTHER VESSEL',
        pairSkipperName: 'Test skipper'
      },
      gears: [
        {
          associationId: record.gears[0].associationId,
          characteristics: [{ characteristicId: 'measurement-1', value: 12 }],
          statisticalArea: { id: 'area-1' },
          speciesCaught: [{ id: 'species-1', weightAboveMinimumKg: 12.5 }]
        }
      ]
    })
    expect(options.headers['If-Match']).toBe('5')
    const [, submitOptions] = fetchMock.mock.calls.find(([url]) =>
      url.endsWith('/submission')
    )
    expect(submitOptions.headers['If-Match']).toBe('6')
    expect(submitOptions.headers['Idempotency-Key']).toBe('review-key')
  })

  test('Should reject stale review versions without replacing or submitting the record', async () => {
    await seed({
      ...recordJourney(record),
      submissionKey: 'review-key',
      submissionVersion: 4
    })
    const response = await call('POST', '/check-answers', {
      submissionKey: 'review-key'
    })
    expect(response.statusCode).toBe(409)
    expect(
      fetchMock.mock.calls.some(([, options]) =>
        ['PUT', 'POST'].includes(options.method)
      )
    ).toBe(false)
  })

  test('Should require reload after an uncertain PUT and never submit it automatically', async () => {
    await seed({
      ...recordJourney(record),
      submissionKey: 'review-key',
      submissionVersion: 5
    })
    const upstream = fetchMock.getMockImplementation()
    fetchMock.mockImplementation((url, options) => {
      if (options.method === 'PUT') throw new Error('timeout')
      return upstream(url, options)
    })
    const response = await call('POST', '/check-answers', {
      submissionKey: 'review-key'
    })
    expect(response.statusCode).toBe(503)
    expect(getJourneyState(response.request).catchRecordReloadRequired).toBe(
      true
    )
    expect(
      fetchMock.mock.calls.some(([url]) => url.endsWith('/submission'))
    ).toBe(false)
    const retry = await call('POST', '/check-answers', {
      submissionKey: 'review-key'
    })
    expect(retry.statusCode).toBe(409)
    expect(
      fetchMock.mock.calls.filter(([, options]) => options.method === 'PUT')
    ).toHaveLength(1)
  })

  test('Should retry uncertain submission without repeating the successful PUT', async () => {
    await seed({
      ...recordJourney(record),
      submissionKey: 'review-key',
      submissionVersion: 5
    })
    const upstream = fetchMock.getMockImplementation()
    let firstSubmission = true
    fetchMock.mockImplementation((url, options) => {
      if (url.endsWith('/submission') && firstSubmission) {
        firstSubmission = false
        throw new Error('timeout')
      }
      return upstream(url, options)
    })
    const first = await call('POST', '/check-answers', {
      submissionKey: 'review-key'
    })
    expect(first.statusCode).toBe(503)
    expect(getJourneyState(first.request)).toMatchObject({
      version: 6,
      submissionVersion: 6,
      replacementSubmissionKey: 'review-key'
    })
    const retry = await call('POST', '/check-answers', {
      submissionKey: 'review-key'
    })
    expect(retry.statusCode).toBe(303)
    expect(
      fetchMock.mock.calls.filter(([, options]) => options.method === 'PUT')
    ).toHaveLength(1)
    const submissions = fetchMock.mock.calls.filter(([url]) =>
      url.endsWith('/submission')
    )
    expect(
      submissions.map(([, options]) => options.headers['If-Match'])
    ).toEqual(['6', '6'])
    expect(
      submissions.map(([, options]) => options.headers['Idempotency-Key'])
    ).toEqual(['review-key', 'review-key'])
  })

  test('Should retain the same submission key and expected version across uncertain retries', async () => {
    await seed({
      ...recordJourney(record),
      submissionKey: 'stable-key',
      replacementSubmissionKey: 'stable-key',
      submissionVersion: 5
    })
    fetchMock.mockRejectedValueOnce(new Error('timeout'))
    const first = await call('POST', '/check-answers', {
      submissionKey: 'stable-key'
    })
    expect(first.statusCode).toBe(503)
    expect(getJourneyState(first.request)).toMatchObject({
      submissionKey: 'stable-key',
      submissionVersion: 5,
      version: 5
    })
    const second = await call('POST', '/check-answers', {
      submissionKey: 'stable-key'
    })
    expect(second.statusCode).toBe(303)
    expect(second.headers.location).toBe('/confirmation')
    expect(getJourneyState(second.request).version).toBe(6)
    expect(
      fetchMock.mock.calls.map(([, options]) => options.headers['If-Match'])
    ).toEqual(['5', '5'])
    expect(
      fetchMock.mock.calls.map(
        ([, options]) => options.headers['Idempotency-Key']
      )
    ).toEqual(['stable-key', 'stable-key'])
    const confirmation = await call('GET', '/confirmation')
    expect(confirmation.result).toContain(record.catchRecordReference)
    const replay = await call('POST', '/check-answers', {
      submissionKey: 'stable-key'
    })
    expect(replay.statusCode).toBe(303)
    expect(fetchMock.mock.calls.at(-1)[1].headers['If-Match']).toBe('5')
  })

  test('Should create a submission key on review and include it in the form', async () => {
    await seed()
    const response = await call('GET', '/check-answers')
    expect(response.statusCode).toBe(200)
    const key = load(response.result)('input[name="submissionKey"]').val()
    expect(key).toMatch(/^[a-f0-9-]{36}$/)
    expect(getJourneyState(response.request)).toMatchObject({
      submissionKey: key,
      submissionVersion: 5
    })
  })

  test('Should not submit before the record has been reviewed', async () => {
    await seed()
    const response = await call('POST', '/check-answers', {})
    expect(response.statusCode).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('Should surface backend errors rather than falling back to fixture lists', async () => {
    fetchMock.mockResolvedValue({ status: 503 })
    const response = await call('GET', '/records')
    expect(response.statusCode).toBe(503)
    expect(response.result).not.toContain('OLGA')
  })

  test('Should disable live-only routes when integration is off', async () => {
    config.set('catchRecording.enabled', false)
    const response = await call('GET', `/records/${record.id}/history`)
    expect(response.statusCode).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
