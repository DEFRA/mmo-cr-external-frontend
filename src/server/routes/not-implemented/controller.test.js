import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#notImplementedController', () => {
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
      url: '/not-implemented'
    })

    expect(result).toEqual(
      expect.stringContaining('Feature not available |')
    )
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should state the feature is not included in this walkthrough', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/not-implemented'
    })

    expect(result).toEqual(
      expect.stringContaining('This feature is not included in this walkthrough.')
    )
  })

  test('Should default the Back link to /records when no return path is supplied', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/not-implemented'
    })
    const $ = load(result)

    expect($('[data-testid="app-page-navigation-back-link"]').attr('href')).toBe(
      '/records'
    )
  })

  test('Should use a known internal return path as the Back link', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/not-implemented?return=/account'
    })
    const $ = load(result)

    expect($('[data-testid="app-page-navigation-back-link"]').attr('href')).toBe(
      '/account'
    )
  })

  test('Should NOT allow an external URL as the Back link (open redirect protection)', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/not-implemented?return=' + encodeURIComponent('https://evil.example')
    })
    const $ = load(result)

    expect($('[data-testid="app-page-navigation-back-link"]').attr('href')).toBe(
      '/records'
    )
  })

  test('Should NOT allow a protocol-relative URL as the Back link', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/not-implemented?return=' + encodeURIComponent('//evil.example')
    })
    const $ = load(result)

    expect($('[data-testid="app-page-navigation-back-link"]').attr('href')).toBe(
      '/records'
    )
  })
})
