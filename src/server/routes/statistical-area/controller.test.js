import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#statisticalAreaController', () => {
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
      url: '/statistical-area'
    })

    expect(result).toEqual(
      expect.stringContaining(
        'Where was most of your catch caught using pots? |'
      )
    )
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should render the question as the page heading with caption', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/statistical-area'
    })
    const $ = load(result)

    expect($('h1').text()).toContain(
      'Where was most of your catch caught using pots?'
    )
    expect($('.govuk-caption-l').first().text().trim()).toBe('New catch record')
  })

  test('Should render the graphical map buttons and the Other action', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/statistical-area'
    })
    const $ = load(result)

    expect($('.app-statistical-area-map__zone')).toHaveLength(11)
    expect($('.app-statistical-area-map__zone--38f02').text().trim()).toBe(
      '38F02'
    )
    expect($('.app-statistical-area-map__other').text().trim()).toBe('Other')
  })

  test('Should render the Back link to the gear selection page', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/statistical-area'
    })
    const $ = load(result)

    expect(
      $('[data-testid="app-page-navigation-back-link"]').attr('href')
    ).toBe('/gear-selection')
  })

  test('Should restore a previously-saved statistical area selection', async () => {
    const setResponse = await server.inject({
      method: 'POST',
      url: '/statistical-area',
      payload: { statisticalArea: '38f02' }
    })
    const cookie = setResponse.headers['set-cookie'][0].split(';')[0]

    const { result } = await server.inject({
      method: 'GET',
      url: '/statistical-area',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('.app-statistical-area-map__zone--38f02').attr('class')).toContain(
      'app-statistical-area-map__zone--selected'
    )
  })
})

describe('#statisticalAreaSubmitController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should redirect to species selection when a named area is chosen', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/statistical-area',
      payload: { statisticalArea: '38f02' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/species-selection')
  })

  test('Should redirect back to check your answers when a return query is supplied', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/statistical-area?return=/check-answers',
      payload: { statisticalArea: '38f02' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/check-answers')
  })

  test('Should set the direct branch back-link on species selection when a named area is chosen', async () => {
    const setResponse = await server.inject({
      method: 'POST',
      url: '/statistical-area',
      payload: { statisticalArea: '38f02' }
    })
    const cookie = setResponse.headers['set-cookie'][0].split(';')[0]

    const { result } = await server.inject({
      method: 'GET',
      url: '/species-selection',
      headers: { cookie }
    })
    const $ = load(result)

    expect(
      $('[data-testid="app-page-navigation-back-link"]').attr('href')
    ).toBe('/statistical-area')
  })

  test('Should redirect to the alternative statistical area page when Other is chosen', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/statistical-area',
      payload: { statisticalArea: 'other' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/statistical-area-other')
  })

  test('Should set the other branch back-link on species selection when Other is chosen', async () => {
    const setResponse = await server.inject({
      method: 'POST',
      url: '/statistical-area',
      payload: { statisticalArea: 'other' }
    })
    const cookie = setResponse.headers['set-cookie'][0].split(';')[0]

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

  test('Should re-render the page with an error summary when nothing is selected', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/statistical-area',
      payload: {}
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary')).toHaveLength(1)
    expect($('.govuk-error-summary').text()).toContain(
      'Select the area where most of your catch was caught'
    )
    expect($('.govuk-error-message')).toHaveLength(1)
  })

  test('Should reject an empty statistical area', async () => {
    const { statusCode } = await server.inject({
      method: 'POST',
      url: '/statistical-area',
      payload: { statisticalArea: '' }
    })

    expect(statusCode).toBe(statusCodes.badRequest)
  })

  test('Should re-render the page with an error summary for an unknown area value', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/statistical-area',
      payload: { statisticalArea: 'unknown' }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary')).toHaveLength(1)
  })
})
