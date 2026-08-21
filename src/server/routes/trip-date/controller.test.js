import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#tripDateController', () => {
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
      url: '/trip-date'
    })

    expect(result).toEqual(
      expect.stringContaining('Did your trip start and finish today? |')
    )
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should render the question as the page heading', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/trip-date'
    })
    const $ = load(result)

    expect($('head > title').text()).toEqual(
      expect.stringContaining('Did your trip start and finish today? |')
    )
    expect($('h1').text()).toContain('Did your trip start and finish today?')
    expect($('h1 .govuk-caption-l').text().trim()).toBe('New catch record')
  })

  test('Should render the Back link to the select vessel page', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/trip-date'
    })
    const $ = load(result)

    expect(
      $('[data-testid="app-page-navigation-back-link"]').attr('href')
    ).toBe('/select-vessel')
  })

  test('Should render Yes and No as a single radio group', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/trip-date'
    })
    const $ = load(result)
    const radios = $('input[type="radio"]')

    expect(radios).toHaveLength(2)
    expect(radios.eq(0).attr('name')).toBe('tripSameDate')
    expect(radios.eq(1).attr('name')).toBe('tripSameDate')
    expect(radios.eq(0).attr('value')).toBe('yes')
    expect(radios.eq(1).attr('value')).toBe('no')
  })

  test('Should render the Save and continue button', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/trip-date'
    })
    const $ = load(result)

    expect($('.govuk-button').text().trim()).toBe('Save and continue')
  })

  test('Should not render any placeholder description text', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/trip-date'
    })
    const $ = load(result)

    expect($('[data-testid="app-placeholder-description"]')).toHaveLength(0)
  })
})

describe('#tripDateSubmitController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should redirect to departure port when Yes', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/trip-date',
      payload: { tripSameDate: 'yes' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/departure-port')
  })

  test('Should redirect back to check your answers when a return query is supplied', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/trip-date?return=/check-answers',
      payload: { tripSameDate: 'yes' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/check-answers')
  })

  test('Should redirect to trip departure date when No', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/trip-date',
      payload: { tripSameDate: 'no' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/trip-departure-date')
  })

  test('Should re-render the page with an error summary when nothing is selected', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/trip-date',
      payload: {}
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('.govuk-error-summary')).toHaveLength(1)
    expect($('.govuk-error-summary').text()).toContain(
      'Select yes if your trip started and finished today'
    )
    expect($('.govuk-error-message')).toHaveLength(1)
  })

  test('Should re-render the page with an error summary for an invalid choice', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/trip-date',
      payload: { tripSameDate: 'maybe' }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('.govuk-error-summary')).toHaveLength(1)
  })
})
