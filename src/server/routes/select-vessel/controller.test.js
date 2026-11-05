import { load } from 'cheerio'
import {
  mockCatchRecording,
  restoreCatchRecordingMock,
  CREATED_DRAFT
} from '#/test-helpers/mock-catch-recording.js'
import { getJourneyState } from '#/server/common/helpers/journey/navigation.js'
import { config } from '#/config/config.js'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import {
  mockVesselsReferenceData,
  restoreVesselsReferenceDataMock,
  VESSEL_IDS
} from '#/test-helpers/mock-vessels-reference-data.js'

beforeEach(() => {
  mockVesselsReferenceData()
  mockCatchRecording()
})
afterEach(() => {
  restoreVesselsReferenceDataMock()
  restoreCatchRecordingMock()
})

describe('#selectVesselController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should provide expected response', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/select-vessel'
    })

    expect(result).toEqual(
      expect.stringContaining('Which vessel did you use? |')
    )
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should render the question as the page heading', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/select-vessel'
    })
    const $ = load(result)

    expect($('h1').text()).toContain('Which vessel did you use?')
    expect($('[data-testid="app-catch-reference"]').text().trim()).toBe(
      'New catch record'
    )
    expect($('h1 .govuk-caption-l')).toHaveLength(0)
  })

  test('Should render the Back link to the records page', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/select-vessel'
    })
    const $ = load(result)

    expect(
      $('[data-testid="app-page-navigation-back-link"]').attr('href')
    ).toBe('/records')
  })

  test('Should render active API vessels with GUIDs and names without registration marks', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/select-vessel'
    })
    const $ = load(result)
    const radios = $('input[type="radio"]')

    expect(radios).toHaveLength(2)
    expect(radios.eq(0).attr('name')).toBe('vesselId')
    expect(radios.eq(0).attr('value')).toBe(VESSEL_IDS.achilles)
    expect($('label').eq(0).text().trim()).toBe('ACHILLES')
    expect(radios.eq(1).attr('value')).toBe(VESSEL_IDS.seaSpray)
    expect($('label').eq(1).text().trim()).toBe('SEA SPRAY')
  })

  test('Should display Home, Your account, and Sign out navigation links', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/select-vessel'
    })
    const $ = load(result)
    const navigation = $('.govuk-service-navigation').text()

    expect(navigation).toContain('Home')
    expect(navigation).toContain('Your account')
    expect(navigation).toContain('Sign out')
  })

  test('Should render the Save and continue button', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/select-vessel'
    })
    const $ = load(result)

    expect($('.govuk-button').text().trim()).toBe('Save and continue')
  })

  test('Should not render an Add vessel control', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/select-vessel'
    })
    const $ = load(result)

    expect($('a:contains("Add vessel")')).toHaveLength(0)
  })

  test('Should not render any placeholder description text', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/select-vessel'
    })
    const $ = load(result)

    expect($('[data-testid="app-placeholder-description"]')).toHaveLength(0)
  })
})

describe('#selectVesselSubmitController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should redirect to the trip date question for the known vessel', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/select-vessel',
      payload: { vesselId: VESSEL_IDS.achilles }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/trip-date')
  })

  test('Should redirect back to check your answers when a return query is supplied', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/select-vessel?return=/check-answers',
      payload: { vesselId: VESSEL_IDS.achilles }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/check-answers')
  })

  test('Should restore the selected API vessel on the selection page', async () => {
    const saved = await server.inject({
      method: 'POST',
      url: '/select-vessel',
      payload: { vesselId: VESSEL_IDS.seaSpray }
    })
    const cookie = saved.headers['set-cookie'][0].split(';')[0]
    const response = await server.inject({
      method: 'GET',
      url: '/select-vessel',
      headers: { cookie }
    })

    expect(
      load(response.result)(`input[value="${VESSEL_IDS.seaSpray}"]`).attr(
        'checked'
      )
    ).toBeDefined()
  })

  test('Should reject a vessel that is not assigned to the account', async () => {
    const { statusCode } = await server.inject({
      method: 'POST',
      url: '/select-vessel',
      payload: { vesselId: 'unknown-vessel' }
    })

    expect(statusCode).toBe(statusCodes.badRequest)
  })

  test('Should reject a missing vessel id', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/select-vessel',
      payload: {}
    })

    expect(statusCode).toBe(statusCodes.badRequest)
    const $ = load(result)
    expect($('.govuk-error-summary').text()).toContain(
      'Which vessel did you use?'
    )
    expect($('.govuk-error-message').text()).toContain(
      'Which vessel did you use?'
    )
    expect(
      $('label.govuk-radios__label')
        .map((_, el) => $(el).text().trim())
        .get()
    ).toEqual(['ACHILLES', 'SEA SPRAY'])
  })

  test('Should persist a draft and reuse it when the same vessel is posted again', async () => {
    const first = await server.inject({
      method: 'POST',
      url: '/select-vessel',
      payload: { vesselId: VESSEL_IDS.achilles }
    })
    expect(first.statusCode).toBe(303)
    expect(getJourneyState(first.request)).toMatchObject({
      catchRecordId: CREATED_DRAFT.id,
      reference: CREATED_DRAFT.catchRecordReference,
      version: 1
    })
    const cookie = first.headers['set-cookie'][0].split(';')[0]
    const second = await server.inject({
      method: 'POST',
      url: '/select-vessel',
      headers: { cookie },
      payload: { vesselId: VESSEL_IDS.achilles }
    })
    expect(second.statusCode).toBe(303)
    const calls = globalThis.fetch.mock.calls.filter(([url]) =>
      url.endsWith('/v1/catch-records')
    )
    expect(calls).toHaveLength(1)
    const page = await server.inject({
      method: 'GET',
      url: '/select-vessel',
      headers: { cookie }
    })
    expect(
      load(page.result)('[data-testid="app-catch-reference"]').text()
    ).toBe(CREATED_DRAFT.catchRecordReference)
  })

  test('Should show a field error when changing the vessel of an existing draft', async () => {
    const first = await server.inject({
      method: 'POST',
      url: '/select-vessel',
      payload: { vesselId: VESSEL_IDS.achilles }
    })
    const cookie = first.headers['set-cookie'][0].split(';')[0]
    const changed = await server.inject({
      method: 'POST',
      url: '/select-vessel',
      headers: { cookie },
      payload: { vesselId: VESSEL_IDS.seaSpray }
    })
    expect(changed.statusCode).toBe(400)
    expect(load(changed.result)('.govuk-error-summary').text()).toContain(
      'You cannot change vessel'
    )
    expect(getJourneyState(changed.request).selectedVesselId).toBe(
      VESSEL_IDS.achilles
    )
  })

  test('Should not redirect or store a draft when the service is unconfigured', async () => {
    config.set('catchRecording.token', null)
    const response = await server.inject({
      method: 'POST',
      url: '/select-vessel',
      payload: { vesselId: VESSEL_IDS.achilles }
    })
    expect(response.statusCode).toBe(503)
    expect(response.headers.location).toBeUndefined()
    expect(getJourneyState(response.request)).not.toHaveProperty(
      'catchRecordId'
    )
    expect(getJourneyState(response.request).draftCreationKey).toBeDefined()
  })

  test('Should reset the journey only when explicitly starting a new record', async () => {
    const first = await server.inject({
      method: 'POST',
      url: '/select-vessel',
      payload: { vesselId: VESSEL_IDS.achilles }
    })
    const cookie = first.headers['set-cookie'][0].split(';')[0]
    const reset = await server.inject({
      method: 'POST',
      url: '/records/new',
      headers: { cookie }
    })
    expect(reset.statusCode).toBe(303)
    expect(reset.headers.location).toBe('/select-vessel')
    expect(getJourneyState(reset.request)).toEqual({})
    const next = await server.inject({
      method: 'POST',
      url: '/select-vessel',
      headers: { cookie: reset.headers['set-cookie'][0].split(';')[0] },
      payload: { vesselId: VESSEL_IDS.seaSpray }
    })
    expect(next.statusCode).toBe(303)
    expect(getJourneyState(next.request).draftCreationKey).not.toBe(
      getJourneyState(first.request).draftCreationKey
    )
  })
})
