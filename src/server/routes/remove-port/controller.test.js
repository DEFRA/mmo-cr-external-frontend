import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#removePortController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should provide expected response with the vessel name in the heading', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/remove-port'
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('h1').text().replace(/\s+/g, ' ').trim()).toBe(
      'Remove ports from vessel OLGA'
    )
  })

  test('Should render "Remove ports from vessel" and the vessel name on separate lines', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/remove-port'
    })
    const $ = load(result)

    expect($('h1').html()).toContain('Remove ports from vessel <br>OLGA')
  })

  test('Should render the Back link to the account page', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/remove-port'
    })
    const $ = load(result)

    expect(
      $('[data-testid="app-page-navigation-back-link"]').attr('href')
    ).toBe('/account')
  })

  test('Should render the account ports used as unchecked checkboxes', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/remove-port'
    })
    const $ = load(result)
    const checkboxes = $('input[type="checkbox"][name="ports"]')

    expect(checkboxes).toHaveLength(1)
    expect($(checkboxes[0]).val()).toBe('Hastings')
    expect(checkboxes.filter((_, el) => $(el).prop('checked'))).toHaveLength(0)
  })
})

describe('#removePortSubmitController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should re-render with an error summary when nothing is selected', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/remove-port',
      payload: {}
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary').text()).toContain(
      'Select the port you want to remove'
    )
  })

  test('Should remove the selected port and redirect to the account page', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/remove-port',
      payload: { ports: 'Hastings' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/account')
  })

  test('Should no longer show a removed port as a checkbox', async () => {
    const setResponse = await server.inject({
      method: 'POST',
      url: '/remove-port',
      payload: { ports: 'Hastings' }
    })
    const cookie = setResponse.headers['set-cookie'][0].split(';')[0]

    const { result } = await server.inject({
      method: 'GET',
      url: '/remove-port',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('input[type="checkbox"][name="ports"]')).toHaveLength(0)
  })

  test('Should redirect back to a safe return path when supplied', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/remove-port?return=/check-answers',
      payload: { ports: 'Hastings' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/check-answers')
  })
})
