import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#confirmSamePortController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should redirect to departure-port when no port query is supplied', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: '/confirm-same-port'
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/departure-port')
  })

  test('Should redirect to departure-port for an unknown port code', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: '/confirm-same-port?port=not-a-real-port'
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/departure-port')
  })

  test('Should render the heading with the port name and Yes/No options', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/confirm-same-port?port=hastings'
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('h1').text()).toContain(
      'Was Hastings the port or the closest port you set off from and returned to?'
    )
    expect($('input[type="radio"]')).toHaveLength(2)
    expect($('input[value="yes"]')).toHaveLength(1)
    expect($('input[value="no"]')).toHaveLength(1)
  })
})

describe('#confirmSamePortSubmitController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should set both departure and return port and continue to gear selection on Yes', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/confirm-same-port?port=hastings',
      payload: { confirmSamePort: 'yes' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/gear-selection')
  })

  test('Should redirect back to check your answers when a return query is supplied', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/confirm-same-port?port=hastings&return=/check-answers',
      payload: { confirmSamePort: 'yes' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/check-answers')
  })

  test('Should redirect to the departure select screen on No', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/confirm-same-port?port=hastings',
      payload: { confirmSamePort: 'no' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/departure-port')
  })

  test('Should re-render with an error when nothing is selected', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/confirm-same-port?port=hastings',
      payload: {}
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary').text()).toContain(
      'Select whether Hastings was the port you set off from and returned to'
    )
  })
})
