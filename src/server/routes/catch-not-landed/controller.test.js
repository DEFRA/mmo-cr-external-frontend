import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#catchNotLandedController', () => {
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
      url: '/catch-not-landed'
    })

    expect(result).toEqual(
      expect.stringContaining('Was any catch not landed? |')
    )
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should render the Back link to the species selection page', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/catch-not-landed'
    })
    const $ = load(result)

    expect(
      $('[data-testid="app-page-navigation-back-link"]').attr('href')
    ).toBe('/species-selection')
  })
})

describe('#catchNotLandedSubmitController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should redirect to check your answers when No', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/catch-not-landed',
      payload: { catchNotLanded: 'no' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/check-answers')
  })

  test('Should redirect to the Empty Page when Yes', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/catch-not-landed',
      payload: { catchNotLanded: 'yes' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/not-implemented?return=/catch-not-landed')
  })

  test('Should reject an invalid choice', async () => {
    const { statusCode } = await server.inject({
      method: 'POST',
      url: '/catch-not-landed',
      payload: { catchNotLanded: 'maybe' }
    })

    expect(statusCode).toBe(statusCodes.badRequest)
  })
})
