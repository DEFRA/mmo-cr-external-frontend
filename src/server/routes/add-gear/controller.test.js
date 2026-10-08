import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import {
  mockGearsReferenceData,
  restoreGearsReferenceDataMock
} from '#/test-helpers/mock-gears-reference-data.js'

function nextCookie(response, previousCookie) {
  const setCookie = response.headers['set-cookie']
  return setCookie ? setCookie[0].split(';')[0] : previousCookie
}

beforeEach(() => mockGearsReferenceData())
afterEach(() => restoreGearsReferenceDataMock())

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

  test('Should point Back to the account when Add gear was opened from the account', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/add-gear?return=/account'
    })
    const $ = load(result)

    expect(
      $('[data-testid="app-page-navigation-back-link"]').attr('href')
    ).toBe('/account')
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
    expect(labels).toContain('Drifting longlines')
    expect(labels).toContain('Nets (Gillnets and Trammels)')
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
      'Select the gear you want to add'
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
    expect(addResponse.headers.location).toBe('/add-gear?step=measurements')

    const cookie = nextCookie(addResponse)
    const { result } = await server.inject({
      method: 'GET',
      url: '/add-gear?step=measurements',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('h1').text().trim()).toBe('Enter the measurements for dredge')
    expect($('#numberOfDredges')).toHaveLength(1)
    expect($('#numberOfTimesShot')).toHaveLength(1)
  })

  test('Should discard an abandoned measurement step and show measurements for a newly selected gear', async () => {
    const firstAdd = await server.inject({
      method: 'POST',
      url: '/add-gear',
      payload: { gear: 'Dredge' }
    })
    let cookie = nextCookie(firstAdd)

    const freshVisit = await server.inject({
      method: 'GET',
      url: '/add-gear',
      headers: { cookie }
    })
    cookie = nextCookie(freshVisit, cookie)
    const $fresh = load(freshVisit.result)

    expect($fresh('#gear')).toHaveLength(1)
    expect($fresh('h1').text()).toContain('What gear did you use?')
    expect($fresh('#numberOfDredges')).toHaveLength(0)

    const secondAdd = await server.inject({
      method: 'POST',
      url: '/add-gear',
      payload: { gear: 'Bottom otter trawl' },
      headers: { cookie }
    })
    cookie = nextCookie(secondAdd, cookie)

    const { result } = await server.inject({
      method: 'GET',
      url: secondAdd.headers.location,
      headers: { cookie }
    })
    const $ = load(result)

    expect($('h1').text().trim()).toBe(
      'Enter the measurements for bottom otter trawl'
    )
    expect($('#numberOfTrawlNets')).toHaveLength(1)
    expect($('#numberOfDredges')).toHaveLength(0)
  })

  test('Should require the reference net measurements before adding it to favourites', async () => {
    const addResponse = await server.inject({
      method: 'POST',
      url: '/add-gear',
      payload: { gear: 'Nets (Gillnets and Trammels)' }
    })
    let cookie = nextCookie(addResponse)

    expect(addResponse.headers.location).toBe('/add-gear?step=measurements')

    const measurementPage = await server.inject({
      method: 'GET',
      url: '/add-gear?step=measurements',
      headers: { cookie }
    })
    const $ = load(measurementPage.result)
    expect($('#meshSize')).toHaveLength(1)
    expect($('#netLengthHauled')).toHaveLength(1)
    expect($('#netLengthLeft')).toHaveLength(1)

    const invalidResponse = await server.inject({
      method: 'POST',
      url: '/add-gear',
      payload: { meshSize: '100', netLengthHauled: '300' },
      headers: { cookie }
    })
    cookie = nextCookie(invalidResponse, cookie)
    const $invalid = load(invalidResponse.result)

    expect(invalidResponse.statusCode).toBe(statusCodes.badRequest)
    expect($invalid('.govuk-error-summary').text()).toContain(
      'Enter the total length of nets left in the water at the end of the trip, in metres'
    )

    const beforeSave = await server.inject({
      method: 'GET',
      url: '/gear-selection',
      headers: { cookie }
    })
    expect(
      load(beforeSave.result)('input[value="gillnets-trammel-nets"]')
    ).toHaveLength(0)

    const saveResponse = await server.inject({
      method: 'POST',
      url: '/add-gear',
      payload: {
        meshSize: '100',
        netLengthHauled: '300',
        netLengthLeft: '50'
      },
      headers: { cookie }
    })
    cookie = nextCookie(saveResponse, cookie)

    expect(saveResponse.statusCode).toBe(303)
    expect(saveResponse.headers.location).toBe('/gear-selection')

    const afterSave = await server.inject({
      method: 'GET',
      url: '/gear-selection',
      headers: { cookie }
    })
    const $afterSave = load(afterSave.result)
    expect($afterSave('input[value="gillnets-trammel-nets"]')).toHaveLength(1)
    expect(
      $afterSave('#gillnets-trammel-nets-netLengthHauled').attr('value')
    ).toBe('300')
  })

  test('Should show "no details required" for gear with no measurements and save it on confirm', async () => {
    const addResponse = await server.inject({
      method: 'POST',
      url: '/add-gear',
      payload: { gear: 'Miscellaneous gear (diving)' }
    })
    const cookie = nextCookie(addResponse)
    expect(addResponse.statusCode).toBe(303)
    expect(addResponse.headers.location).toBe('/gear-selection')

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
      'Number of rods and lines must be a whole number greater than 0'
    )
  })

  test('Should reject fields that do not belong to the pending gear measurements', async () => {
    const addResponse = await server.inject({
      method: 'POST',
      url: '/add-gear',
      payload: { gear: 'Dredge' }
    })
    const cookie = nextCookie(addResponse)

    const response = await server.inject({
      method: 'POST',
      url: '/add-gear',
      payload: { numberOfDredges: '2', unexpectedField: 'value' },
      headers: { cookie }
    })

    expect(response.statusCode).toBe(statusCodes.badRequest)
    expect(load(response.result)('.govuk-error-summary')).toHaveLength(1)
  })

  test.each([
    ['0', 'Number of rods and lines must be a whole number greater than 0'],
    ['', 'Enter the number of rods and lines']
  ])(
    'Should reject rods and lines value "%s" and not add the gear to favourites',
    async (rodsAndLines, expectedError) => {
      const addResponse = await server.inject({
        method: 'POST',
        url: '/add-gear',
        payload: { gear: 'Handlines and pole lines (hand operated)' }
      })
      const cookie = nextCookie(addResponse)

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: '/add-gear',
        payload: { rodsAndLines },
        headers: { cookie }
      })
      const $ = load(result)

      expect(statusCode).toBe(statusCodes.badRequest)
      expect($('.govuk-error-summary').text()).toContain(expectedError)
      expect($('#rodsAndLines')).toHaveLength(1)
    }
  )

  test.each([
    ['0', 'Enter a number greater than 0'],
    ['1.5', 'Enter a whole number'],
    ['-1.5', 'Enter a whole number greater than 0'],
    ['abc', 'Enter a whole number greater than 0']
  ])(
    'Should show a generic error for number of trawl nets value "%s"',
    async (numberOfTrawlNets, expectedError) => {
      const addResponse = await server.inject({
        method: 'POST',
        url: '/add-gear',
        payload: { gear: 'Bottom otter trawl' }
      })
      const cookie = nextCookie(addResponse)

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: '/add-gear',
        payload: { numberOfTrawlNets, meshSize: '0' },
        headers: { cookie }
      })
      const $ = load(result)

      expect(statusCode).toBe(statusCodes.badRequest)
      expect($('.govuk-error-summary').text()).toContain(expectedError)
      expect($('.govuk-error-summary').text()).toContain(
        'Mesh size must be a whole number greater than 0'
      )
    }
  )

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
      '/add-gear?return=%2Fcheck-answers&step=measurements'
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

  test('Should return to the account after adding measured gear from the account', async () => {
    const addResponse = await server.inject({
      method: 'POST',
      url: '/add-gear?return=/account',
      payload: { gear: 'Dredge' }
    })
    const cookie = nextCookie(addResponse)
    const { result: measurementPage } = await server.inject({
      method: 'GET',
      url: addResponse.headers.location,
      headers: { cookie }
    })
    const $ = load(measurementPage)

    expect(
      $('[data-testid="app-page-navigation-back-link"]').attr('href')
    ).toBe('/account')

    const confirmResponse = await server.inject({
      method: 'POST',
      url: '/add-gear?return=/account',
      payload: { numberOfDredges: '2', numberOfTimesShot: '3' },
      headers: { cookie }
    })

    expect(confirmResponse.statusCode).toBe(303)
    expect(confirmResponse.headers.location).toBe('/account')
  })
})
