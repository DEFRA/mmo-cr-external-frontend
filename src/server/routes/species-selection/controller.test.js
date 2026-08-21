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
        weightAboveMinimum: '120.5'
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
    expect($('#weightAboveMinimum').attr('value')).toBe('120.5')
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

  test('Should show the weight below minimum field when add-below-minimum is submitted', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/species-selection',
      payload: { speciesIds: 'cod', speciesAction: 'add-below-minimum' }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('#weightBelowMinimum')).toHaveLength(1)
    expect($('input[value="cod"]').prop('checked')).toBe(true)
  })

  test('Should show the weight legally discarded field when add-legally-discarded is submitted', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/species-selection',
      payload: { speciesIds: 'cod', speciesAction: 'add-legally-discarded' }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('#weightDiscarded')).toHaveLength(1)
  })

  test('Should show both optional weight fields when both have been added in sequence', async () => {
    const firstResponse = await server.inject({
      method: 'POST',
      url: '/species-selection',
      payload: { speciesIds: 'cod', speciesAction: 'add-below-minimum' }
    })
    const $first = load(firstResponse.result)

    expect($first('input[name="belowMinimumVisible"]').attr('value')).toBe(
      'true'
    )

    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/species-selection',
      payload: {
        speciesIds: 'cod',
        speciesAction: 'add-legally-discarded',
        belowMinimumVisible: 'true'
      }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('#weightBelowMinimum')).toHaveLength(1)
    expect($('#weightDiscarded')).toHaveLength(1)
  })

  test('Should hide the weight below minimum field and clear its value when removed', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/species-selection',
      payload: {
        speciesIds: 'cod',
        speciesAction: 'remove-below-minimum',
        belowMinimumVisible: 'true',
        weightBelowMinimum: '8.2'
      }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('#weightBelowMinimum')).toHaveLength(0)
  })

  test('Should hide the weight legally discarded field and clear its value when removed', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/species-selection',
      payload: {
        speciesIds: 'cod',
        speciesAction: 'remove-legally-discarded',
        legallyDiscardedVisible: 'true',
        weightDiscarded: '3.1'
      }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('#weightDiscarded')).toHaveLength(0)
  })

  test('Should re-render with a field error when the legally-discarded weight is missing', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/species-selection',
      payload: {
        speciesIds: 'cod',
        speciesAction: 'continue',
        weightAboveMinimum: '120.5',
        legallyDiscardedVisible: 'true',
        weightDiscarded: ''
      }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary').text()).toContain(
      'Enter the weight legally discarded'
    )
  })

  test('Should redirect to catch not landed when cod is selected with a valid weight', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/species-selection',
      payload: {
        speciesIds: 'cod',
        speciesAction: 'continue',
        weightAboveMinimum: '120.5'
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
        weightAboveMinimum: '120.5'
      }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/check-answers')
  })

  test('Should redirect to the Empty Page when cod is not among the selected species', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/species-selection',
      payload: { speciesIds: 'had', speciesAction: 'continue' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/not-implemented?return=/species-selection')
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
      'Select the species you caught'
    )
    expect($('.govuk-error-summary a').attr('href')).toBe('#speciesIds')
  })

  test('Should re-render with a field error when cod is selected but the primary weight is missing', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/species-selection',
      payload: { speciesIds: 'cod', speciesAction: 'continue' }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary').text()).toContain(
      'Enter the weight above minimum size retained'
    )
    expect($('#weightAboveMinimum-error')).toHaveLength(1)
  })

  test('Should re-render with a field error when the below-minimum weight is missing', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/species-selection',
      payload: {
        speciesIds: 'cod',
        speciesAction: 'continue',
        weightAboveMinimum: '120.5',
        belowMinimumVisible: 'true',
        weightBelowMinimum: ''
      }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary').text()).toContain(
      'Enter the weight below minimum size retained'
    )
  })

  test('Should re-render with a field error when the below-minimum weight has an invalid format', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/species-selection',
      payload: {
        speciesIds: 'cod',
        speciesAction: 'continue',
        weightAboveMinimum: '120.5',
        belowMinimumVisible: 'true',
        weightBelowMinimum: '12.345'
      }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary').text()).toContain(
      'Enter the weight below minimum size retained'
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
