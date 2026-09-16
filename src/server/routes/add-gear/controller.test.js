import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#addGearController', () => {
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
      url: '/add-gear'
    })

    expect(result).toEqual(expect.stringContaining('What gear did you use? |'))
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should render the reference number as the caption and the question as the page heading', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/add-gear'
    })
    const $ = load(result)

    expect($('h1').text()).toContain('What gear did you use?')
    expect($('[data-testid="app-add-gear-caption"]').text().trim()).toBe(
      'A1234520260727150815'
    )
  })

  test('Should render the search input with a placeholder and no separate field label', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/add-gear'
    })
    const $ = load(result)

    expect($('#gear').attr('placeholder')).toBe(
      'Start typing to display the list'
    )
    expect($('body').text()).not.toContain('Gear type')
  })

  test('Should render the Back link to the gear selection page', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/add-gear'
    })
    const $ = load(result)

    expect(
      $('[data-testid="app-page-navigation-back-link"]').attr('href')
    ).toBe('/gear-selection')
  })

  test('Should list catalogue gear not already favourited in the datalist', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/add-gear'
    })
    const $ = load(result)
    const labels = $('#gear-options option')
      .map((_, el) => $(el).attr('value'))
      .get()

    expect(labels).toContain('Set net')
    expect(labels).not.toContain('Beam trawl')
  })
})

describe('#addGearSubmitController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should re-render with an error summary when the field is empty', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/add-gear',
      payload: { gear: '' }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary').text()).toContain(
      'Enter the name of the gear you want to add'
    )
  })

  test('Should re-render with an error summary for an unrecognised gear name', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/add-gear',
      payload: { gear: 'Not a real gear type' }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary').text()).toContain(
      'Select a gear type from the list'
    )
  })

  test('Should add the matched gear to favourites and redirect to gear selection', async () => {
    const setResponse = await server.inject({
      method: 'POST',
      url: '/add-gear',
      payload: { gear: 'Set net' }
    })

    expect(setResponse.statusCode).toBe(303)
    expect(setResponse.headers.location).toBe('/gear-selection')

    const cookie = setResponse.headers['set-cookie'][0].split(';')[0]
    const { result } = await server.inject({
      method: 'GET',
      url: '/gear-selection',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('input[value="set-net"]')).toHaveLength(1)
  })

  test('Should match gear names case-insensitively and not add duplicates', async () => {
    const first = await server.inject({
      method: 'POST',
      url: '/add-gear',
      payload: { gear: 'long line' }
    })
    const cookie = first.headers['set-cookie'][0].split(';')[0]

    await server.inject({
      method: 'POST',
      url: '/add-gear',
      payload: { gear: 'Long line' },
      headers: { cookie }
    })

    const { result } = await server.inject({
      method: 'GET',
      url: '/gear-selection',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('input[value="long-line"]')).toHaveLength(1)
  })

  test('Should redirect back to check your answers when a return query is supplied', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/add-gear?return=/check-answers',
      payload: { gear: 'Tangle net' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/check-answers')
  })
})
