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

  test('Should show the current favourites summary', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/add-gear'
    })
    const $ = load(result)

    expect($('[data-testid="app-added-gear"]').text()).toContain('Beam trawl')
  })
})

function nextCookie(response, previousCookie) {
  const setCookie = response.headers['set-cookie']
  return setCookie ? setCookie[0].split(';')[0] : previousCookie
}

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
      payload: { action: 'add', gear: '' }
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
      payload: { action: 'add', gear: 'Not a real gear type' }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary').text()).toContain(
      'Select a gear type from the list'
    )
  })

  test('Should add gear with no required measurement straight away and stay on the page', async () => {
    // "Miscellaneous gear (diving)" is a default favourite, so it must be
    // removed first to exercise the "add a no-measurement gear" save path.
    const removeResponse = await server.inject({
      method: 'POST',
      url: '/remove-gear',
      payload: { gearIds: 'miscellaneous-gear-diving' }
    })
    let cookie = nextCookie(removeResponse)

    const addResponse = await server.inject({
      method: 'POST',
      url: '/add-gear',
      payload: { action: 'add', gear: 'Miscellaneous gear (diving)' },
      headers: { cookie }
    })
    cookie = nextCookie(addResponse, cookie)

    expect(addResponse.statusCode).toBe(303)
    expect(addResponse.headers.location).toBe('/add-gear')

    const { result } = await server.inject({
      method: 'GET',
      url: '/add-gear',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('[data-testid="app-added-gear"]').text()).toContain(
      'Miscellaneous gear (diving)'
    )
  })

  test('Should ask for the required measurement before saving gear that needs one', async () => {
    const addResponse = await server.inject({
      method: 'POST',
      url: '/add-gear',
      payload: { action: 'add', gear: 'Set net' }
    })
    const cookie = nextCookie(addResponse)

    const { result } = await server.inject({
      method: 'GET',
      url: '/add-gear',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('h1').text().trim()).toBe(
      'What is the mesh size (mm) for Set net?'
    )
    expect($('input[name="gearId"]').attr('value')).toBe('set-net')

    const gearSelectionResponse = await server.inject({
      method: 'GET',
      url: '/gear-selection',
      headers: { cookie }
    })
    expect(
      load(gearSelectionResponse.result)('input[value="set-net"]')
    ).toHaveLength(0)
  })

  test('Should re-render with an error and not save when the measurement is missing or invalid', async () => {
    const addResponse = await server.inject({
      method: 'POST',
      url: '/add-gear',
      payload: { action: 'add', gear: 'Set net' }
    })
    const cookie = nextCookie(addResponse)

    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/add-gear',
      payload: {
        action: 'confirm-measurement',
        gearId: 'set-net',
        measurementValue: '-4.5'
      },
      headers: { cookie }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary').text()).toContain(
      'Enter the mesh size (mm)'
    )
  })

  test('Should save the gear and its measurement once confirmed, then return to the search page', async () => {
    const addResponse = await server.inject({
      method: 'POST',
      url: '/add-gear',
      payload: { action: 'add', gear: 'Set net' }
    })
    let cookie = nextCookie(addResponse)

    const confirmResponse = await server.inject({
      method: 'POST',
      url: '/add-gear',
      payload: {
        action: 'confirm-measurement',
        gearId: 'set-net',
        measurementValue: '90'
      },
      headers: { cookie }
    })
    cookie = nextCookie(confirmResponse, cookie)

    expect(confirmResponse.statusCode).toBe(303)
    expect(confirmResponse.headers.location).toBe('/add-gear')

    const { result } = await server.inject({
      method: 'GET',
      url: '/add-gear',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('[data-testid="app-added-gear"]').text()).toContain('Set net')
    expect($('h1').text().trim()).toBe('What gear did you use?')
  })

  test('Should let the user cancel adding a gear that requires a measurement without saving it', async () => {
    const addResponse = await server.inject({
      method: 'POST',
      url: '/add-gear',
      payload: { action: 'add', gear: 'Set net' }
    })
    let cookie = nextCookie(addResponse)

    const cancelResponse = await server.inject({
      method: 'POST',
      url: '/add-gear',
      payload: { action: 'cancel' },
      headers: { cookie }
    })
    cookie = nextCookie(cancelResponse, cookie)

    expect(cancelResponse.statusCode).toBe(303)

    const { result } = await server.inject({
      method: 'GET',
      url: '/add-gear',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('h1').text().trim()).toBe('What gear did you use?')
    expect($('[data-testid="app-added-gear"]').text()).not.toContain('Set net')
  })

  test('Should let the user keep adding several gears before saving and continuing', async () => {
    const addFirst = await server.inject({
      method: 'POST',
      url: '/add-gear',
      payload: { action: 'add', gear: 'Long line' }
    })
    let cookie = nextCookie(addFirst)

    const confirmFirst = await server.inject({
      method: 'POST',
      url: '/add-gear',
      payload: {
        action: 'confirm-measurement',
        gearId: 'long-line',
        measurementValue: '50'
      },
      headers: { cookie }
    })
    cookie = nextCookie(confirmFirst, cookie)

    const addSecond = await server.inject({
      method: 'POST',
      url: '/add-gear',
      payload: { action: 'add', gear: 'Dredge' },
      headers: { cookie }
    })
    cookie = nextCookie(addSecond, cookie)

    const confirmSecond = await server.inject({
      method: 'POST',
      url: '/add-gear',
      payload: {
        action: 'confirm-measurement',
        gearId: 'dredge',
        measurementValue: '2'
      },
      headers: { cookie }
    })
    cookie = nextCookie(confirmSecond, cookie)

    const continueResponse = await server.inject({
      method: 'POST',
      url: '/add-gear',
      payload: { action: 'continue' },
      headers: { cookie }
    })

    expect(continueResponse.statusCode).toBe(303)
    expect(continueResponse.headers.location).toBe('/gear-selection')

    const { result } = await server.inject({
      method: 'GET',
      url: '/gear-selection',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('input[value="long-line"]')).toHaveLength(1)
    expect($('input[value="dredge"]')).toHaveLength(1)
  })

  test('Should not add duplicate favourites when the same gear is added again', async () => {
    const addFirst = await server.inject({
      method: 'POST',
      url: '/add-gear',
      payload: { action: 'add', gear: 'Long line' }
    })
    let cookie = nextCookie(addFirst)

    const confirmFirst = await server.inject({
      method: 'POST',
      url: '/add-gear',
      payload: {
        action: 'confirm-measurement',
        gearId: 'long-line',
        measurementValue: '50'
      },
      headers: { cookie }
    })
    cookie = nextCookie(confirmFirst, cookie)

    const addSecond = await server.inject({
      method: 'POST',
      url: '/add-gear',
      payload: { action: 'add', gear: 'Long line' },
      headers: { cookie }
    })
    cookie = nextCookie(addSecond, cookie)

    const confirmSecond = await server.inject({
      method: 'POST',
      url: '/add-gear',
      payload: {
        action: 'confirm-measurement',
        gearId: 'long-line',
        measurementValue: '75'
      },
      headers: { cookie }
    })
    cookie = nextCookie(confirmSecond, cookie)

    const { result } = await server.inject({
      method: 'GET',
      url: '/gear-selection',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('input[value="long-line"]')).toHaveLength(1)
  })

  test('Should preserve a return query across adds and honour it on continue', async () => {
    const addResponse = await server.inject({
      method: 'POST',
      url: '/add-gear?return=/check-answers',
      payload: { action: 'add', gear: 'Long line' }
    })
    let cookie = nextCookie(addResponse)

    expect(addResponse.statusCode).toBe(303)
    expect(addResponse.headers.location).toBe(
      '/add-gear?return=%2Fcheck-answers'
    )

    const confirmResponse = await server.inject({
      method: 'POST',
      url: '/add-gear?return=/check-answers',
      payload: {
        action: 'confirm-measurement',
        gearId: 'long-line',
        measurementValue: '50'
      },
      headers: { cookie }
    })
    cookie = nextCookie(confirmResponse, cookie)

    expect(confirmResponse.headers.location).toBe(
      '/add-gear?return=%2Fcheck-answers'
    )

    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/add-gear?return=/check-answers',
      payload: { action: 'continue' },
      headers: { cookie }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/check-answers')
  })
})
