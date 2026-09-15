import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#addSpeciesController', () => {
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
      url: '/add-species'
    })

    expect(result).toEqual(
      expect.stringContaining('Add species to your vessel OLGA |')
    )
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should render the Back link to the species selection page', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/add-species'
    })
    const $ = load(result)

    expect(
      $('[data-testid="app-page-navigation-back-link"]').attr('href')
    ).toBe('/species-selection')
  })

  test('Should render the New catch record caption above the heading', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/add-species'
    })
    const $ = load(result)

    expect($('.govuk-caption-l').text().trim()).toBe('New catch record')
  })

  test('Should render a search input with a datalist that excludes already-added species', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/add-species'
    })
    const $ = load(result)

    expect($('#species').attr('placeholder')).toBe(
      'Start typing to display the list'
    )
    expect($('#species-options option[value="Herring (HER)"]')).toHaveLength(1)
    expect(
      $('#species-options option[value="Atlantic cod (COD)"]')
    ).toHaveLength(0)
  })
})

describe('#addSpeciesSubmitController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should re-render with an error when no species is entered', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/add-species',
      payload: { species: '' }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary').text()).toContain(
      'Enter the species you want to add'
    )
  })

  test('Should re-render with an error when the entered species is not recognised', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/add-species',
      payload: { species: 'Not a real species' }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary').text()).toContain(
      'Select a species to add'
    )
  })

  test('Should re-render with an error when the species has already been added', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/add-species',
      payload: { species: 'Atlantic cod (COD)' }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary').text()).toContain(
      'This species has already been added.'
    )
  })

  test('Should add a new species and redirect to species selection', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/add-species',
      payload: { species: 'Herring (HER)' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/species-selection')
  })

  test('Should show the newly added species as a checkbox on species selection', async () => {
    const setResponse = await server.inject({
      method: 'POST',
      url: '/add-species',
      payload: { species: 'Herring (HER)' }
    })
    const cookie = setResponse.headers['set-cookie'][0].split(';')[0]

    const { result } = await server.inject({
      method: 'GET',
      url: '/species-selection',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('input[value="her"]')).toHaveLength(1)
  })

  test('Should redirect back to check your answers when a return query is supplied', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/add-species?return=/check-answers',
      payload: { species: 'Mackerel (MAC)' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/check-answers')
  })
})
