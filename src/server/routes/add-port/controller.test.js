import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#addPortController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should render the departure entry heading', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/add-port?for=departure&entry=1'
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('h1').text().trim()).toBe(
      'Enter the port or closest port you set off from'
    )
  })

  test('Should render the return entry heading', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/add-port?for=return'
    })
    const $ = load(result)

    expect($('h1').text().trim()).toBe(
      'Enter the port or closest port you returned to'
    )
  })

  test('Should render the search input and Save and continue button', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/add-port?for=departure&entry=1'
    })
    const $ = load(result)

    expect($('[data-port-search]')).toHaveLength(1)
    expect($('.govuk-button').text().trim()).toBe('Save and continue')
  })
})

describe('#addPortSubmitController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should redirect to confirm-same-port after a first-time (entry) save', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/add-port?for=departure&entry=1',
      payload: { port: 'Hastings' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/confirm-same-port?port=hastings')
  })

  test('Should save the port as a favourite so the select screen shows it', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/add-port?for=departure&entry=1',
      payload: { port: 'Hastings' }
    })
    const cookie = response.headers['set-cookie'][0].split(';')[0]

    const { result } = await server.inject({
      method: 'GET',
      url: '/departure-port',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('input[value="hastings"]')).toHaveLength(1)
  })

  test('Should redirect back to the departure select screen when adding another port', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/add-port?for=departure',
      payload: { port: 'Newhaven' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/departure-port')
  })

  test('Should redirect back to the return select screen when adding another port', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/add-port?for=return',
      payload: { port: 'Rye' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/return-port')
  })

  test('Should re-render with an error when no port is entered', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/add-port?for=departure&entry=1',
      payload: {}
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary').text()).toContain(
      'Select a port from the list'
    )
  })

  test('Should re-render with an error when the entered text does not match a known port', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/add-port?for=departure&entry=1',
      payload: { port: 'Not a real port' }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary').text()).toContain(
      'Select a port from the list'
    )
  })
})
