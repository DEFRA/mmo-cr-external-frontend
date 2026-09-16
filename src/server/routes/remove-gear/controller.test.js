import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#removeGearController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should provide expected response with the vessel name in the heading', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/remove-gear'
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('h1').text().replace(/\s+/g, ' ').trim()).toBe(
      'Remove gear from vessel OLGA'
    )
  })

  test('Should render "Remove gear from vessel" and the vessel name on separate lines with no caption', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/remove-gear'
    })
    const $ = load(result)

    expect($('h1').html()).toContain('Remove gear from vessel <br>OLGA')
    expect($('.govuk-caption-l')).toHaveLength(0)
  })

  test('Should render the "Select all that apply" hint below the heading', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/remove-gear'
    })
    const $ = load(result)

    expect($('.govuk-hint').first().text().trim()).toBe('Select all that apply')
  })

  test('Should render the Back link to the gear selection page', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/remove-gear'
    })
    const $ = load(result)

    expect(
      $('[data-testid="app-page-navigation-back-link"]').attr('href')
    ).toBe('/gear-selection')
  })

  test('Should render the default favourite gear as unchecked checkboxes', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/remove-gear'
    })
    const $ = load(result)
    const checkboxes = $('input[type="checkbox"][name="gearIds"]')

    expect(checkboxes).toHaveLength(9)
    expect(checkboxes.filter((_, el) => $(el).prop('checked'))).toHaveLength(0)
  })
})

describe('#removeGearSubmitController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should re-render with an error summary when nothing is selected', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/remove-gear',
      payload: {}
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary').text()).toContain(
      'Select the gear you want to remove'
    )
  })

  test('Should remove the selected gear from favourites and redirect to gear selection', async () => {
    const setResponse = await server.inject({
      method: 'POST',
      url: '/remove-gear',
      payload: { gearIds: 'traps' }
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

    expect($('input[value="traps"]')).toHaveLength(0)
  })

  test('Should clear pots details when pots is removed', async () => {
    const withPots = await server.inject({
      method: 'POST',
      url: '/gear-selection',
      payload: { gearIds: 'pots', potsHauled: '10', potsInWater: '5' }
    })
    const setupCookie = withPots.headers['set-cookie'][0].split(';')[0]

    const removeResponse = await server.inject({
      method: 'POST',
      url: '/remove-gear',
      payload: { gearIds: 'pots' },
      headers: { cookie: setupCookie }
    })
    const cookie = removeResponse.headers['set-cookie'][0].split(';')[0]

    const { result } = await server.inject({
      method: 'GET',
      url: '/gear-selection',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('input[value="pots"]')).toHaveLength(0)
    expect($('#potsHauled').attr('value')).toBeUndefined()
  })

  test('Should redirect back to check your answers when a return query is supplied', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/remove-gear?return=/check-answers',
      payload: { gearIds: 'dredge' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/check-answers')
  })
})
