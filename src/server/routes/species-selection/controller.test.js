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

    expect(result).toEqual(
      expect.stringContaining('What species did you catch using pots? |')
    )
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

  test('Should link Add species and Remove species to their respective routes', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/species-selection'
    })
    const $ = load(result)

    expect($('a[href="/add-species?return=/species-selection"]')).toHaveLength(
      1
    )
    expect(
      $('a[href="/remove-species?return=/species-selection"]')
    ).toHaveLength(1)
  })

  test('Should render the 3 species checkboxes with stable ids in order', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/species-selection'
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

  test('Should hide the cod weight fields conditional when cod is not selected', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/species-selection'
    })
    const $ = load(result)

    expect(
      $('#speciesIds-conditional-1').hasClass(
        'govuk-checkboxes__conditional--hidden'
      )
    ).toBe(true)
  })

  test('Should restore previously-selected species and weights as checked/pre-filled', async () => {
    const setResponse = await server.inject({
      method: 'POST',
      url: '/species-selection',
      payload: {
        speciesIds: 'cod',
        speciesAction: 'continue',
        'weightAboveMinimum-cod': '120.5'
      }
    })
    const cookie = setResponse.headers['set-cookie'][0].split(';')[0]

    const { result } = await server.inject({
      method: 'GET',
      url: '/species-selection',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('input[value="cod"]').prop('checked')).toBe(true)
    expect($('#weightAboveMinimum-cod').attr('value')).toBe('120.5')
    expect(
      $('#speciesIds-conditional-1').hasClass(
        'govuk-checkboxes__conditional--hidden'
      )
    ).toBe(false)
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

  test('Should render the below-minimum weight field expanded when it already has a value', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/species-selection',
      payload: {
        speciesIds: 'cod',
        speciesAction: 'continue',
        'weightBelowMinimum-cod': '8.2'
      }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('#weightBelowMinimum-cod')).toHaveLength(1)
    expect(
      $('#weightBelowMinimum-cod-group').hasClass('govuk-visually-hidden')
    ).toBe(false)
  })

  test('Should render the legally-discarded weight field expanded when it already has a value', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/species-selection',
      payload: {
        speciesIds: 'cod',
        speciesAction: 'continue',
        'weightDiscarded-cod': '3.1'
      }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('#weightDiscarded-cod')).toHaveLength(1)
    expect(
      $('#weightDiscarded-cod-group').hasClass('govuk-visually-hidden')
    ).toBe(false)
  })

  test('Should render the js-weight-toggle links for revealing the optional weight fields', async () => {
    const { result } = await server.inject({
      method: 'POST',
      url: '/species-selection',
      payload: { speciesIds: 'cod', speciesAction: 'continue' }
    })
    const $ = load(result)

    expect(
      $('a.js-weight-toggle[data-target="weightBelowMinimum-cod-group"]').text()
    ).toBe('Add weight below minimum size retained (kg)')
    expect(
      $('a.js-weight-toggle[data-target="weightDiscarded-cod-group"]').text()
    ).toBe('Add weight legally discarded (kg)')
  })

  test('Should redirect to catch not landed when the below-minimum and legally-discarded weights are both provided', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/species-selection',
      payload: {
        speciesIds: 'cod',
        speciesAction: 'continue',
        'weightAboveMinimum-cod': '120.5',
        'weightBelowMinimum-cod': '8.2',
        'weightDiscarded-cod': '3.1'
      }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/catch-not-landed')
  })

  test('Should redirect to catch not landed when cod is selected with a valid weight', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/species-selection',
      payload: {
        speciesIds: 'cod',
        speciesAction: 'continue',
        'weightAboveMinimum-cod': '120.5'
      }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/catch-not-landed')
  })

  test('Should redirect back to check your answers when a return query is supplied', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/species-selection?return=/check-answers',
      payload: {
        speciesIds: 'cod',
        speciesAction: 'continue',
        'weightAboveMinimum-cod': '120.5'
      }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/check-answers')
  })

  test('Should redirect to catch not landed when a non-cod species is selected with a valid weight', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/species-selection',
      payload: {
        speciesIds: 'had',
        speciesAction: 'continue',
        'weightAboveMinimum-had': '4.2'
      }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/catch-not-landed')
  })

  test('Should re-render the page with an error summary when no species is selected', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/species-selection',
      payload: { speciesAction: 'continue' }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary')).toHaveLength(1)
    expect($('.govuk-error-summary').text()).toContain(
      'Select at least one species'
    )
    expect($('.govuk-error-summary a').attr('href')).toBe('#speciesIds')
  })

  test('Should ignore an unknown speciesId rather than error', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/species-selection',
      payload: { speciesIds: 'mon', speciesAction: 'continue' }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary').text()).toContain(
      'Select at least one species'
    )
  })

  test('Should re-render with a named field error when cod is selected but the primary weight is missing', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/species-selection',
      payload: { speciesIds: 'cod', speciesAction: 'continue' }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary').text()).toContain(
      'Enter a weight for atlantic cod (cod)'
    )
    expect($('#weightAboveMinimum-cod-error')).toHaveLength(1)
  })

  test('Should re-render with a named field error when the below-minimum weight has an invalid format', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/species-selection',
      payload: {
        speciesIds: 'cod',
        speciesAction: 'continue',
        'weightAboveMinimum-cod': '120.5',
        'weightBelowMinimum-cod': '12.345'
      }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary').text()).toContain(
      'Enter a weight below minimum size retained for atlantic cod (cod)'
    )
  })

  test('Should re-render with a named field error when the legally-discarded weight has an invalid format', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/species-selection',
      payload: {
        speciesIds: 'cod',
        speciesAction: 'continue',
        'weightAboveMinimum-cod': '120.5',
        'weightDiscarded-cod': '12.345'
      }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary').text()).toContain(
      'Enter a weight legally discarded for atlantic cod (cod)'
    )
  })

  test('Should reject an unknown speciesAction value', async () => {
    const { statusCode } = await server.inject({
      method: 'POST',
      url: '/species-selection',
      payload: { speciesIds: 'cod', speciesAction: 'not-a-real-action' }
    })

    expect(statusCode).toBe(statusCodes.badRequest)
  })
})
