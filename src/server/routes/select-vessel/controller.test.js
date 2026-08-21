import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import { getData } from '#/server/common/data/get-data.js'

describe('#selectVesselController', () => {
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
      url: '/select-vessel'
    })

    expect(result).toEqual(expect.stringContaining('Select your vessel |'))
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should render the question as the page heading', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/select-vessel'
    })
    const $ = load(result)

    expect($('h1').text()).toContain('Select your vessel')
    expect($('h1 .govuk-caption-l').text().trim()).toBe('New catch record')
  })

  test('Should render the Back link to the draft page', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/select-vessel'
    })
    const $ = load(result)

    expect(
      $('[data-testid="app-page-navigation-back-link"]').attr('href')
    ).toBe('/draft')
  })

  test('Should render OLGA as a radio option using the stable vessel id', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/select-vessel'
    })
    const $ = load(result)
    const radios = $('input[type="radio"]')

    expect(radios).toHaveLength(1)
    expect(radios.eq(0).attr('name')).toBe('vesselId')
    expect(radios.eq(0).attr('value')).toBe('olga')
    expect($('label').eq(0).text().trim()).toBe('OLGA')
  })

  test('Should render the Save and continue button', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/select-vessel'
    })
    const $ = load(result)

    expect($('.govuk-button').text().trim()).toBe('Save and continue')
  })

  test('Should not render an Add vessel control', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/select-vessel'
    })
    const $ = load(result)

    expect($('a:contains("Add vessel")')).toHaveLength(0)
  })

  test('Should not render any placeholder description text', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/select-vessel'
    })
    const $ = load(result)

    expect($('[data-testid="app-placeholder-description"]')).toHaveLength(0)
  })
})

describe('#selectVesselSubmitController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should redirect to the trip date question for the known vessel', async () => {
    const beforeVessel = getData('selectVessel')

    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/select-vessel',
      payload: { vesselId: 'olga' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/trip-date')
    expect(getData('selectVessel')).toEqual(beforeVessel)
  })

  test('Should redirect back to check your answers when a return query is supplied', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/select-vessel?return=/check-answers',
      payload: { vesselId: 'olga' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/check-answers')
  })

  test('Should reject an unknown vessel id', async () => {
    const { statusCode } = await server.inject({
      method: 'POST',
      url: '/select-vessel',
      payload: { vesselId: 'unknown-vessel' }
    })

    expect(statusCode).toBe(statusCodes.badRequest)
  })

  test('Should reject a missing vessel id', async () => {
    const { statusCode } = await server.inject({
      method: 'POST',
      url: '/select-vessel',
      payload: {}
    })

    expect(statusCode).toBe(statusCodes.badRequest)
  })
})
