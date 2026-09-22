import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

function nextCookie(response, previousCookie) {
  const setCookie = response.headers['set-cookie']
  return setCookie ? setCookie[0].split(';')[0] : previousCookie
}

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
      payload: { gear: 'set net' }
    })
    let cookie = nextCookie(first)

    const confirm = await server.inject({
      method: 'POST',
      url: '/add-gear',
      payload: {},
      headers: { cookie }
    })
    cookie = nextCookie(confirm, cookie)

    await server.inject({
      method: 'POST',
      url: '/add-gear',
      payload: { gear: 'Set net' },
      headers: { cookie }
    })

    const { result } = await server.inject({
      method: 'GET',
      url: '/gear-selection',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('input[value="set-net"]')).toHaveLength(1)
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

  test('Should show the measurement page for gear that requires measurements', async () => {
    const addResponse = await server.inject({
      method: 'POST',
      url: '/add-gear',
      payload: { gear: 'Dredge' }
    })

    expect(addResponse.statusCode).toBe(303)
    expect(addResponse.headers.location).toBe('/add-gear')

    const cookie = nextCookie(addResponse)
    const { result } = await server.inject({
      method: 'GET',
      url: '/add-gear',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('h1').text().trim()).toBe('Enter the measurements for dredge')
    expect($('#numberOfDredges')).toHaveLength(1)
    expect($('#numberOfTimesShot')).toHaveLength(1)
  })

  test('Should show "no details required" for gear with no measurements and save it on confirm', async () => {
    const addResponse = await server.inject({
      method: 'POST',
      url: '/add-gear',
      payload: { gear: 'Miscellaneous gear (diving)' }
    })
    let cookie = nextCookie(addResponse)

    const { result } = await server.inject({
      method: 'GET',
      url: '/add-gear',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('[data-testid="app-no-measurements-needed"]').text()).toBe(
      'No details required for this type of gear.'
    )

    const confirmResponse = await server.inject({
      method: 'POST',
      url: '/add-gear',
      payload: {},
      headers: { cookie }
    })
    cookie = nextCookie(confirmResponse, cookie)

    expect(confirmResponse.statusCode).toBe(303)
    expect(confirmResponse.headers.location).toBe('/gear-selection')

    const gearSelectionResponse = await server.inject({
      method: 'GET',
      url: '/gear-selection',
      headers: { cookie }
    })
    expect(
      load(gearSelectionResponse.result)(
        'input[value="miscellaneous-gear-diving"]'
      )
    ).toHaveLength(1)
  })

  test('Should re-render with an error and not save when a required measurement is missing or invalid', async () => {
    const addResponse = await server.inject({
      method: 'POST',
      url: '/add-gear',
      payload: { gear: 'Handlines and pole lines (hand operated)' }
    })
    const cookie = nextCookie(addResponse)

    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/add-gear',
      payload: { rodsAndLines: '-2' },
      headers: { cookie }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary').text()).toContain(
      'Enter the number of rods and lines'
    )
  })

  test('Should save all measurements and redirect to gear selection once confirmed', async () => {
    const addResponse = await server.inject({
      method: 'POST',
      url: '/add-gear',
      payload: { gear: 'Bottom otter trawl' }
    })
    let cookie = nextCookie(addResponse)

    const confirmResponse = await server.inject({
      method: 'POST',
      url: '/add-gear',
      payload: { numberOfTrawlNets: '2', meshSize: '80' },
      headers: { cookie }
    })
    cookie = nextCookie(confirmResponse, cookie)

    expect(confirmResponse.statusCode).toBe(303)
    expect(confirmResponse.headers.location).toBe('/gear-selection')

    const { result } = await server.inject({
      method: 'GET',
      url: '/gear-selection',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('input[value="bottom-otter-trawl"]')).toHaveLength(1)
  })

  test('Should preserve a return query across the measurement step', async () => {
    const addResponse = await server.inject({
      method: 'POST',
      url: '/add-gear?return=/check-answers',
      payload: { gear: 'Dredge' }
    })
    const cookie = nextCookie(addResponse)

    expect(addResponse.headers.location).toBe(
      '/add-gear?return=%2Fcheck-answers'
    )

    const confirmResponse = await server.inject({
      method: 'POST',
      url: '/add-gear?return=/check-answers',
      payload: { numberOfDredges: '2', numberOfTimesShot: '3' },
      headers: { cookie }
    })

    expect(confirmResponse.statusCode).toBe(303)
    expect(confirmResponse.headers.location).toBe('/check-answers')
  })
})
