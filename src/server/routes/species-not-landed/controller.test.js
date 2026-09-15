import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#speciesNotLandedController', () => {
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
      url: '/species-not-landed'
    })

    expect(result).toEqual(
      expect.stringContaining(
        'Which species from this trip are you not landing straight away? |'
      )
    )
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should default the Back link to catch not landed', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/species-not-landed'
    })
    const $ = load(result)

    expect(
      $('[data-testid="app-page-navigation-back-link"]').attr('href')
    ).toBe('/catch-not-landed')
  })

  test('Should render the 3 species checkboxes with stable ids in order', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/species-not-landed'
    })
    const $ = load(result)
    const checkboxes = $('input[type="checkbox"][name="speciesIds"]')

    expect(checkboxes).toHaveLength(3)
    expect(checkboxes.map((_, el) => $(el).attr('value')).get()).toEqual([
      'cod',
      'had',
      'sal'
    ])
  })

  test('Should hide the cod weight field conditional when cod is not selected', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/species-not-landed'
    })
    const $ = load(result)

    expect(
      $('#speciesIds-conditional-1').hasClass(
        'govuk-checkboxes__conditional--hidden'
      )
    ).toBe(true)
  })
})

describe('#speciesNotLandedSubmitController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should re-render the page with an error summary when no species is selected', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/species-not-landed',
      payload: {}
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary').text()).toContain(
      'Select at least one species'
    )
  })

  test('Should re-render with a generic error when the payload fails schema validation', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/species-not-landed',
      payload: { speciesIds: { notAValidShape: true } }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary').text()).toContain(
      'There was a problem with your submission'
    )
  })

  test('Should re-render with a named field error when the weight is missing', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/species-not-landed',
      payload: { speciesIds: 'cod' }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary').text()).toContain(
      'Enter a weight for atlantic cod (cod)'
    )
  })

  test('Should re-render with a named field error when the weight has an invalid format', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/species-not-landed',
      payload: { speciesIds: 'cod', 'weightAboveMinimum-cod': '12.345' }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary').text()).toContain(
      'Enter a weight for atlantic cod (cod)'
    )
  })

  test('Should ignore an unknown speciesId rather than error', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/species-not-landed',
      payload: { speciesIds: 'mon' }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary').text()).toContain(
      'Select at least one species'
    )
  })

  test('Should redirect to check your answers when a valid species and weight are submitted', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/species-not-landed',
      payload: { speciesIds: 'cod', 'weightAboveMinimum-cod': '5' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/check-answers')
  })

  test('Should redirect back to check your answers when a return query is supplied', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/species-not-landed?return=/check-answers',
      payload: { speciesIds: 'cod', 'weightAboveMinimum-cod': '5' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/check-answers')
  })

  test('Should restore previously-selected species and weights as checked/pre-filled', async () => {
    const setResponse = await server.inject({
      method: 'POST',
      url: '/species-not-landed',
      payload: { speciesIds: 'cod', 'weightAboveMinimum-cod': '5' }
    })
    const cookie = setResponse.headers['set-cookie'][0].split(';')[0]

    const { result } = await server.inject({
      method: 'GET',
      url: '/species-not-landed',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('input[value="cod"]').prop('checked')).toBe(true)
    expect($('#weightAboveMinimum-cod').attr('value')).toBe('5')
  })
})
