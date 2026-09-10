import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

async function withDeparturePort(server, code) {
  const response = await server.inject({
    method: 'POST',
    url: '/departure-port',
    payload: { departurePort: code }
  })
  return response.headers['set-cookie'][0].split(';')[0]
}

describe('#returnPortController', () => {
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
      url: '/return-port'
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/add-port?for=return')
  })

  test('Should provide expected response', async () => {
    const cookie = await withDeparturePort(server, 'hastings')

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/return-port',
      headers: { cookie }
    })

    expect(result).toEqual(
      expect.stringContaining('Select the port you returned to |')
    )
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should render the question as the page heading with caption', async () => {
    const cookie = await withDeparturePort(server, 'hastings')

    const { result } = await server.inject({
      method: 'GET',
      url: '/return-port',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('head > title').text()).toEqual(
      expect.stringContaining('Select the port you returned to |')
    )
    expect($('h1').text()).toContain('Select the port you returned to')
    expect($('h1 .govuk-caption-l').text().trim()).toBe('New catch record')
  })

  test('Should render only the saved favourite ports as radio options', async () => {
    let cookie = await withDeparturePort(server, 'hastings')

    const addResponse = await server.inject({
      method: 'POST',
      url: '/add-port?for=return',
      payload: { port: 'Newhaven' },
      headers: { cookie }
    })
    cookie = addResponse.headers['set-cookie'][0].split(';')[0]

    const { result } = await server.inject({
      method: 'GET',
      url: '/return-port',
      headers: { cookie }
    })
    const $ = load(result)
    const radios = $('input[type="radio"]')

    expect(radios).toHaveLength(2)
    expect(radios.eq(0).attr('value')).toBe('hastings')
    expect(radios.eq(1).attr('value')).toBe('newhaven')
  })

  test('Should render the Save and continue and Add port buttons', async () => {
    const cookie = await withDeparturePort(server, 'hastings')

    const { result } = await server.inject({
      method: 'GET',
      url: '/return-port',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('.govuk-button').eq(0).text().trim()).toBe('Save and continue')
    expect($('.govuk-button').eq(1).text().trim()).toBe('Add port')
    expect($('.govuk-button').eq(1).attr('href')).toBe('/add-port?for=return')
  })

  test('Should render the Back link to the departure port page', async () => {
    const cookie = await withDeparturePort(server, 'hastings')

    const { result } = await server.inject({
      method: 'GET',
      url: '/return-port',
      headers: { cookie }
    })
    const $ = load(result)

    expect(
      $('[data-testid="app-page-navigation-back-link"]').attr('href')
    ).toBe('/departure-port')
  })

  test('Should restore a previously-saved return port selection', async () => {
    const setResponse = await server.inject({
      method: 'POST',
      url: '/return-port',
      payload: { returnPort: 'rye' }
    })
    const cookie = setResponse.headers['set-cookie'][0].split(';')[0]

    const { result } = await server.inject({
      method: 'GET',
      url: '/return-port',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('input[value="rye"]').prop('checked')).toBe(true)
  })

  test('Should leave the departure port unaffected by a return port submission', async () => {
    const departureResponse = await server.inject({
      method: 'POST',
      url: '/departure-port',
      payload: { departurePort: 'hastings' }
    })
    const cookie = departureResponse.headers['set-cookie'][0].split(';')[0]

    await server.inject({
      method: 'POST',
      url: '/return-port',
      payload: { returnPort: 'newhaven' },
      headers: { cookie }
    })

    const { result } = await server.inject({
      method: 'GET',
      url: '/departure-port',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('input[value="hastings"]').prop('checked')).toBe(true)
  })
})

describe('#returnPortSubmitController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should redirect to the gear selection page on a valid selection', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/return-port',
      payload: { returnPort: 'hastings' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/gear-selection')
  })

  test('Should redirect back to check your answers when a return query is supplied', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/return-port?return=/check-answers',
      payload: { returnPort: 'hastings' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/check-answers')
  })

  test('Should re-render the page with an error summary when nothing is selected', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/return-port',
      payload: {}
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary')).toHaveLength(1)
    expect($('.govuk-error-summary').text()).toContain(
      'Select the port you returned to'
    )
    expect($('.govuk-error-message')).toHaveLength(1)
  })

  test('Should re-render the page with an error summary for an unknown port code', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/return-port',
      payload: { returnPort: 'not-a-real-port' }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary')).toHaveLength(1)
  })
})

