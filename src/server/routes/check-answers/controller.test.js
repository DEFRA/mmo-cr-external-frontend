import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import {
  mockSpeciesReferenceData,
  restoreSpeciesReferenceDataMock
} from '#/test-helpers/mock-species-reference-data.js'
import { mockPortsReferenceData } from '#/test-helpers/mock-ports-reference-data.js'
import { mockGearsReferenceData } from '#/test-helpers/mock-gears-reference-data.js'

beforeEach(() => {
  mockSpeciesReferenceData()
  mockPortsReferenceData()
  mockGearsReferenceData()
})
afterEach(() => restoreSpeciesReferenceDataMock())

describe('#checkAnswersController', () => {
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
      url: '/check-answers'
    })

    expect(result).toEqual(expect.stringContaining('Check your answers |'))
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should render only the mobile review headings without a caption', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/check-answers'
    })
    const $ = load(result)

    expect($('h1').text()).toContain('Check your answers')
    expect($('[data-testid="app-check-answers-caption"]')).toHaveLength(0)
    expect(
      $('h2.govuk-heading-l')
        .map((_, el) => $(el).text().trim())
        .get()
    ).toEqual(['Trip', 'Pot', 'Species not landed'])
  })

  test('Should show Save and continue without extra declaration content', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/check-answers'
    })
    const $ = load(result)

    expect($('.govuk-warning-text')).toHaveLength(0)
    expect($('.govuk-list--bullet')).toHaveLength(0)
    expect($('input[name="confirmAccurate"]')).toHaveLength(0)
    expect($('.govuk-button').text().trim()).toBe('Save and continue')
    expect($('dt').text()).not.toMatch(/Departure date|Return date|Not landed/)
  })

  test('Should render the illustrative example values when no journey state exists', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/check-answers'
    })
    const $ = load(result)

    expect($('dd').eq(0).text().trim()).toBe('OLGA')
  })

  test('Should reflect real captured journey answers over the illustrative example', async () => {
    const tripDateResponse = await server.inject({
      method: 'POST',
      url: '/trip-date',
      payload: { tripSameDate: 'yes' }
    })
    let cookie = tripDateResponse.headers['set-cookie'][0].split(';')[0]

    const steps = [
      ['/departure-port', { departurePort: 'newhaven' }],
      ['/return-port', { returnPort: 'rye' }],
      ['/gear-selection', { gearIds: 'dredge' }],
      ['/statistical-area', { statisticalArea: '38f02' }],
      [
        '/species-selection',
        {
          speciesIds: 'cod',
          speciesAction: 'continue',
          'weightAboveMinimum-cod': '3'
        }
      ],
      ['/catch-not-landed', { catchNotLanded: 'no' }]
    ]

    for (const [url, payload] of steps) {
      const response = await server.inject({
        method: 'POST',
        url,
        payload,
        headers: { cookie }
      })
      cookie = response.headers['set-cookie'][0].split(';')[0]
    }

    const { result } = await server.inject({
      method: 'GET',
      url: '/check-answers',
      headers: { cookie }
    })
    const $ = load(result)
    const text = $.text()

    expect(text).toContain('Newhaven')
    expect(text).toContain('Rye')
    expect(text).toContain('Dredge')
    expect($('dt:contains("Not landed")')).toHaveLength(0)
    expect($('h2').text()).not.toContain('Species not landed')
  })
})

describe('#checkAnswersSubmitController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should continue to confirmation without a declaration payload', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/check-answers',
      payload: {}
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/confirmation')
  })
})

describe('#checkAnswers change loop', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should return to Check Your Answers after changing the departure port', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/departure-port?return=/check-answers',
      payload: { departurePort: 'hastings' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/check-answers')
  })

  test('Should collect answers before returning to Check Your Answers for a newly selected gear', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/gear-selection?return=/check-answers',
      payload: { gearIds: 'dredge' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/statistical-area?gearId=dredge')
  })

  test('Should ignore an unsafe return destination and continue the default journey', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/departure-port?return=https://evil.example',
      payload: { departurePort: 'hastings' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/return-port')
  })
})
