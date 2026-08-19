import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#departurePortController', () => {
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
      url: '/departure-port'
    })

    expect(result).toEqual(
      expect.stringContaining('Which port did you leave from? |')
    )
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should render the question as the page heading with caption', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/departure-port'
    })
    const $ = load(result)

    expect($('head > title').text()).toEqual(
      expect.stringContaining('Which port did you leave from? |')
    )
    expect($('h1').text()).toContain('Which port did you leave from?')
    expect($('h1 .govuk-caption-l').text().trim()).toBe('New catch record')
  })

  test('Should render all three ports as radio options', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/departure-port'
    })
    const $ = load(result)
    const radios = $('input[type="radio"]')

    expect(radios).toHaveLength(3)
    expect(radios.eq(0).attr('value')).toBe('hastings')
    expect(radios.eq(1).attr('value')).toBe('newhaven')
    expect(radios.eq(2).attr('value')).toBe('rye')
  })

  test('Should render the Save and continue button', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/departure-port'
    })
    const $ = load(result)

    expect($('.govuk-button').text().trim()).toBe('Save and continue')
    expect($('.govuk-button')).toHaveLength(1)
  })

  test('Should default the Back link to trip date when no journey state exists', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/departure-port'
    })
    const $ = load(result)

    expect(
      $('[data-testid="app-page-navigation-back-link"]').attr('href')
    ).toBe('/trip-date')
  })

  test('Should point the Back link to trip return date after the different-date branch', async () => {
    const setResponse = await server.inject({
      method: 'POST',
      url: '/trip-date',
      payload: { tripSameDate: 'no' }
    })
    const cookie = setResponse.headers['set-cookie'][0].split(';')[0]

    const { result } = await server.inject({
      method: 'GET',
      url: '/departure-port',
      headers: { cookie }
    })
    const $ = load(result)

    expect(
      $('[data-testid="app-page-navigation-back-link"]').attr('href')
    ).toBe('/trip-return-date')
  })

  test('Should restore a previously-saved departure port selection', async () => {
    const setResponse = await server.inject({
      method: 'POST',
      url: '/departure-port',
      payload: { departurePort: 'newhaven' }
    })
    const cookie = setResponse.headers['set-cookie'][0].split(';')[0]

    const { result } = await server.inject({
      method: 'GET',
      url: '/departure-port',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('input[value="newhaven"]').prop('checked')).toBe(true)
    expect($('input[value="hastings"]').prop('checked')).toBe(false)
    expect($('input[value="rye"]').prop('checked')).toBe(false)
  })
})

describe('#departurePortSubmitController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should redirect to the return port page on a valid selection', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/departure-port',
      payload: { departurePort: 'hastings' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/return-port')
  })

  test('Should re-render the page with an error summary when nothing is selected', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/departure-port',
      payload: {}
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary')).toHaveLength(1)
    expect($('.govuk-error-summary').text()).toContain(
      'Select the port you left from'
    )
    expect($('.govuk-error-message')).toHaveLength(1)
  })

  test('Should re-render the page with an error summary for an unknown port code', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/departure-port',
      payload: { departurePort: 'dover' }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary')).toHaveLength(1)
  })
})
