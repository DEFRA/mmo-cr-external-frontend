import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#speciesSelectionController', () => {
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
      url: '/species-selection'
    })

    expect(result).toEqual(expect.stringContaining('Species selection |'))
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should default the Back link to statistical area when no journey state exists', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/species-selection'
    })
    const $ = load(result)

    expect(
      $('[data-testid="app-page-navigation-back-link"]').attr('href')
    ).toBe('/statistical-area')
  })

  test('Should point the Back link to the alternative statistical area after the Other branch', async () => {
    const setResponse = await server.inject({
      method: 'POST',
      url: '/statistical-area',
      payload: { statisticalArea: 'other' }
    })
    const cookie = setResponse.headers['set-cookie']

    const { result } = await server.inject({
      method: 'GET',
      url: '/species-selection',
      headers: { cookie }
    })
    const $ = load(result)

    expect(
      $('[data-testid="app-page-navigation-back-link"]').attr('href')
    ).toBe('/statistical-area-other')
  })

  test('Should link Add species and Remove species to the Empty Page', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/species-selection'
    })
    const $ = load(result)

    expect(
      $('a[href="/not-implemented?return=/species-selection"]')
    ).toHaveLength(2)
  })

  test('Should render the available species options', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/species-selection'
    })
    const $ = load(result)
    const optionsText = $('[data-testid="app-species-options-list"]').text()

    expect(optionsText).toContain('Atlantic cod (COD)')
    expect(optionsText).toContain('Haddock (HAD)')
    expect(optionsText).toContain('Salmon (SAL)')
  })
})

describe('#speciesSelectionSubmitController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should redirect to the species weight page', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/species-selection'
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/species-weight')
  })
})
