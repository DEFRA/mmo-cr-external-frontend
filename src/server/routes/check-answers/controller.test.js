import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import {
  mockSpeciesReferenceData,
  restoreSpeciesReferenceDataMock
} from '#/test-helpers/mock-species-reference-data.js'
import { mockPortsReferenceData } from '#/test-helpers/mock-ports-reference-data.js'
import { mockGearsReferenceData } from '#/test-helpers/mock-gears-reference-data.js'
import * as checkAnswersViewModel from './view-model.js'

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

    expect(result).toEqual(expect.stringContaining('Catch record for OLGA |'))
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should reuse the submitted-record heading, reference and section order', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/check-answers'
    })
    const $ = load(result)

    expect($('h1').text()).toContain('Catch record for OLGA')
    expect($('[data-testid="app-record-reference"]').text().trim()).toBe(
      'A1234520260727150815'
    )
    expect(
      $('h2.govuk-heading-l')
        .map((_, el) => $(el).text().trim())
        .get()
    ).toEqual([
      'Trips details',
      'Gear used',
      'Species caught',
      'Species not landed'
    ])
  })

  test('Should render only read-only answers with no editing or submission controls', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/check-answers'
    })
    const $ = load(result)

    expect(
      $('main form, main input, main select, main textarea, main button')
    ).toHaveLength(0)
    expect($('main a')).toHaveLength(0)
    expect($('main .govuk-summary-list__actions')).toHaveLength(0)
    expect($('.govuk-warning-text')).toHaveLength(0)
    expect($('main').text()).not.toMatch(
      /Change|Edit catch record|Download PDF|Accept and submit/
    )
    expect($('.govuk-back-link').attr('href')).toBe('/records')
    expect($('dt').text()).toContain('Departure date')
    expect($('dt').text()).toContain('Return date')
    expect($('dt').text()).toContain('Not landed')
  })

  test('Should strip supplied row actions at the read-only rendering boundary', async () => {
    const buildViewModel = vi.spyOn(
      checkAnswersViewModel,
      'buildCheckAnswersViewModel'
    )
    buildViewModel.mockReturnValue({
      sections: [
        {
          heading: 'Trips details',
          rows: [
            {
              key: { text: 'Vessel' },
              value: { text: 'OLGA' },
              actions: { items: [{ href: '/select-vessel', text: 'Change' }] }
            }
          ]
        }
      ]
    })
    try {
      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/check-answers'
      })
      const $ = load(result)
      expect(statusCode).toBe(statusCodes.ok)
      expect($('main').text()).toContain('OLGA')
      expect($('main a, main .govuk-summary-list__actions')).toHaveLength(0)
    } finally {
      buildViewModel.mockRestore()
    }
  })

  test('Should preserve submitted-record row order and value formatting for the default record', async () => {
    const source = await server.inject({
      method: 'GET',
      url: '/records/submitted-1'
    })
    const review = await server.inject({ method: 'GET', url: '/check-answers' })
    const $source = load(source.result)
    const $review = load(review.result)

    expect(
      $review('dt')
        .map((_, element) => $review(element).text().trim())
        .get()
    ).toEqual(
      $source('dt')
        .map((_, element) => $source(element).text().trim())
        .get()
    )
    expect(
      $review('.govuk-summary-list__value')
        .map((_, element) => $review(element).text().trim())
        .get()
    ).toEqual(
      $source('.govuk-summary-list__value')
        .map((_, element) => $source(element).text().trim())
        .get()
    )
    expect($source('a[href*="/edit-reason"]')).toHaveLength(1)
    expect($review('main a')).toHaveLength(0)
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
    expect($('h2').text()).toContain('Species not landed')
    expect($('dt:contains("Not landed")').next().text().trim()).toBe('No')
  })
})

describe('Read-only check-answers route', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should reject POST submission', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/check-answers',
      payload: {}
    })

    expect(statusCode).toBe(404)
    expect(headers.location).toBeUndefined()
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
