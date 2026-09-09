import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

async function withFavourite(server, code) {
  const response = await server.inject({
    method: 'POST',
    url: '/departure-port',
    payload: { departurePort: code }
  })
  return response.headers['set-cookie'][0].split(';')[0]
}

describe('#departurePortController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should redirect to add a port when no favourites have been saved yet', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: '/departure-port'
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/add-port?for=departure&entry=1')
  })

  test('Should provide expected response', async () => {
    const cookie = await withFavourite(server, 'hastings')

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/departure-port',
      headers: { cookie }
    })

    expect(result).toEqual(
      expect.stringContaining('Select the port you left from |')
    )
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should render the question as the page heading with caption', async () => {
    const cookie = await withFavourite(server, 'hastings')

    const { result } = await server.inject({
      method: 'GET',
      url: '/departure-port',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('head > title').text()).toEqual(
      expect.stringContaining('Select the port you left from |')
    )
    expect($('h1').text()).toContain('Select the port you left from')
    expect($('h1 .govuk-caption-l').text().trim()).toBe('New catch record')
  })

  test('Should render only the saved favourite ports as radio options', async () => {
    const setResponse = await server.inject({
      method: 'POST',
      url: '/departure-port',
      payload: { departurePort: 'hastings' }
    })
    let cookie = setResponse.headers['set-cookie'][0].split(';')[0]

    const addResponse = await server.inject({
      method: 'POST',
      url: '/add-port?for=departure',
      payload: { port: 'Newhaven' },
      headers: { cookie }
    })
    cookie = addResponse.headers['set-cookie'][0].split(';')[0]

    const { result } = await server.inject({
      method: 'GET',
      url: '/departure-port',
      headers: { cookie }
    })
    const $ = load(result)
    const radios = $('input[type="radio"]')

    expect(radios).toHaveLength(2)
    expect(radios.eq(0).attr('value')).toBe('hastings')
    expect(radios.eq(1).attr('value')).toBe('newhaven')
  })

  test('Should render the Save and continue and Add port buttons', async () => {
    const cookie = await withFavourite(server, 'hastings')

    const { result } = await server.inject({
      method: 'GET',
      url: '/departure-port',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('.govuk-button').eq(0).text().trim()).toBe('Save and continue')
    expect($('.govuk-button').eq(1).text().trim()).toBe('Add port')
    expect($('.govuk-button').eq(1).attr('href')).toBe(
      '/add-port?for=departure'
    )
  })

  test('Should default the Back link to trip date when no journey state exists', async () => {
    const cookie = await withFavourite(server, 'hastings')

    const { result } = await server.inject({
      method: 'GET',
      url: '/departure-port',
      headers: { cookie }
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
    let cookie = setResponse.headers['set-cookie'][0].split(';')[0]

    const favouriteResponse = await server.inject({
      method: 'POST',
      url: '/departure-port',
      payload: { departurePort: 'hastings' },
      headers: { cookie }
    })
    cookie = favouriteResponse.headers['set-cookie'][0].split(';')[0]

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

  test('Should redirect back to check your answers when a return query is supplied', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/departure-port?return=/check-answers',
      payload: { departurePort: 'hastings' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/check-answers')
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
      payload: { departurePort: 'not-a-real-port' }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary')).toHaveLength(1)
  })
})

