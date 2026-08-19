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

    expect(result).toEqual(expect.stringContaining('Departure port |'))
    expect(statusCode).toBe(statusCodes.ok)
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

  test('Should redirect to the return port page', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/departure-port'
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/return-port')
  })
})
