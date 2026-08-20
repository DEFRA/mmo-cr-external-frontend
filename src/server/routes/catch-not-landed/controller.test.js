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
      expect.stringContaining(
        'Is there any catch you won\u2019t be landing straight away? |'
      )
    )
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should render the question as the single page heading with caption', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/catch-not-landed'
    })
    const $ = load(result)

    expect($('h1')).toHaveLength(1)
    expect($('h1').text()).toContain(
      'Is there any catch you won\u2019t be landing straight away?'
    )
    expect($('h1 .govuk-caption-l').text().trim()).toBe('New catch record')
  })

  test('Should not render the old heading or placeholder implementation text', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/catch-not-landed'
    })

    expect(result).not.toContain('Was any catch not landed?')
    expect(result).not.toContain(
      'will be implemented in a later step'
    )
  })

  test('Should render the approved hint text', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/catch-not-landed'
    })
    const $ = load(result)

    expect($('.govuk-hint').text().trim()).toBe(
      'For example, keeping white fish onboard for bait or storing shellfish in keep pots.'
    )
  })

  test('Should render the Save and continue button and not the old Continue copy', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/catch-not-landed'
    })
    const $ = load(result)

    expect($('.govuk-button').text().trim()).toBe('Save and continue')
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

  test('Should re-render the page with an error summary when nothing is selected', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/catch-not-landed',
      payload: {}
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary')).toHaveLength(1)
    expect($('.govuk-error-summary').text()).toContain(
      'Select yes if any catch will not be landed straight away'
    )
    expect($('.govuk-error-message')).toHaveLength(1)
  })
})
