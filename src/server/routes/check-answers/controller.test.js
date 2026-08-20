import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

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

    expect(result).toEqual(expect.stringContaining('Check your catch record |'))
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should render the heading with caption and all four sections in order', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/check-answers'
    })
    const $ = load(result)

    expect($('h1').text()).toContain('Check your catch record')
    expect(
      $('[data-testid="app-check-answers-caption"]').text().trim()
    ).toBe('New catch record')
    expect($('h2.govuk-heading-l').map((_, el) => $(el).text().trim()).get()).toEqual([
      'Trips details',
      'Gear used',
      'Species caught',
      'Species not landed',
      'Trips details'
    ])
  })

  test('Should render the declaration warning, bullets, checkbox and button', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/check-answers'
    })
    const $ = load(result)

    expect($('.govuk-warning-text__text').text()).toContain(
      "By submitting this record, you agree that the information you've given is complete and correct."
    )
    expect($('.govuk-list--bullet li')).toHaveLength(3)
    expect($('input[name="confirmAccurate"][type="checkbox"]')).toHaveLength(1)
    expect($('.govuk-button').text().trim()).toBe(
      'Accept and submit trip details'
    )
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
          weightAboveMinimum: '3'
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
    expect($('dt:contains("Not landed")').next().text().trim()).toBe('No')
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

  test('Should redirect to the confirmation page when the declaration is confirmed', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/check-answers',
      payload: { confirmAccurate: 'true' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/confirmation')
  })

  test('Should re-render the page with an accessible error when the declaration is not confirmed', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/check-answers',
      payload: {}
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary')).toHaveLength(1)
    expect($('.govuk-error-summary').text()).toContain(
      'Select I confirm the information is complete and accurate'
    )
    expect($('.govuk-error-summary a').attr('href')).toBe('#confirmAccurate')
    expect($('.govuk-error-message')).toHaveLength(1)
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

  test('Should return to Check Your Answers after changing the gear used', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/gear-selection?return=/check-answers',
      payload: { gearIds: 'dredge' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/check-answers')
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

