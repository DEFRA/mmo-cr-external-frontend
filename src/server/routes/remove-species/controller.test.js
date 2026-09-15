import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#removeSpeciesController', () => {
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
      url: '/remove-species'
    })

    expect(result).toEqual(expect.stringContaining('Remove a species |'))
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should render the Back link to the species selection page', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/remove-species'
    })
    const $ = load(result)

    expect(
      $('[data-testid="app-page-navigation-back-link"]').attr('href')
    ).toBe('/species-selection')
  })

  test('Should render the New catch record caption above the heading', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/remove-species'
    })
    const $ = load(result)

    expect($('.govuk-caption-l').text().trim()).toBe('New catch record')
  })

  test('Should render the "Select all that apply" hint', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/remove-species'
    })
    const $ = load(result)

    expect($('.govuk-hint').first().text().trim()).toBe('Select all that apply')
  })

  test('Should render 3 unchecked species checkboxes by default', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/remove-species'
    })
    const $ = load(result)
    const checkboxes = $('input[type="checkbox"][name="speciesIds"]')

    expect(checkboxes).toHaveLength(3)
    checkboxes.each((_, el) => {
      expect($(el).prop('checked')).toBe(false)
    })
  })
})

describe('#removeSpeciesSubmitController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should re-render with an error when nothing is selected', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/remove-species',
      payload: {}
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary').text()).toContain(
      'Select the species you want to remove'
    )
  })

  test('Should remove the selected species and redirect to species selection', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/remove-species',
      payload: { speciesIds: 'had' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/species-selection')
  })

  test('Should no longer show a removed species as a checkbox on species selection', async () => {
    const setResponse = await server.inject({
      method: 'POST',
      url: '/remove-species',
      payload: { speciesIds: 'had' }
    })
    const cookie = setResponse.headers['set-cookie'][0].split(';')[0]

    const { result } = await server.inject({
      method: 'GET',
      url: '/species-selection',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('input[value="had"]')).toHaveLength(0)
    expect($('input[type="checkbox"][name="speciesIds"]')).toHaveLength(2)
  })

  test('Should redirect to add species when all species have been removed', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/remove-species',
      payload: { speciesIds: ['cod', 'had', 'sal'] }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/add-species')
  })

  test('Should redirect back to check your answers when a return query is supplied', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/remove-species?return=/check-answers',
      payload: { speciesIds: 'had' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/check-answers')
  })
})
