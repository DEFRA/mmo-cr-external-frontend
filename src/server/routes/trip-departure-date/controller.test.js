import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

// Midday on 1 Nov 2025 (Europe/London), so the 365-day floor is still earlier than the 24 July 2025 launch floor.
const TODAY = '2025-11-01T12:00:00Z'

describe('#tripDepartureDateController', () => {
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
      url: '/trip-departure-date'
    })

    expect(result).toEqual(
      expect.stringContaining('Which date did you set off on your trip? |')
    )
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should render the question as the page heading with hint and Back link', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/trip-departure-date'
    })
    const $ = load(result)

    expect($('head > title').text()).toEqual(
      expect.stringContaining('Which date did you set off on your trip? |')
    )
    expect($('h1').text()).toContain('Which date did you set off on your trip?')
    expect($('h1 .govuk-caption-l').text().trim()).toBe('New catch record')
    expect($('.govuk-hint').first().text().trim()).toBe(
      'For example, 31/03/2020'
    )
    expect(
      $('[data-testid="app-page-navigation-back-link"]').attr('href')
    ).toBe('/trip-date')
  })

  test('Should render blank Day, Month and Year inputs', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/trip-departure-date'
    })
    const $ = load(result)

    expect($('#tripDepartureDate-day').val()).toBeUndefined()
    expect($('#tripDepartureDate-month').val()).toBeUndefined()
    expect($('#tripDepartureDate-year').val()).toBeUndefined()
  })
})

describe('#tripDepartureDateSubmitController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(TODAY))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should redirect to the trip return date page on a valid date', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/trip-departure-date',
      payload: {
        'tripDepartureDate-day': '31',
        'tripDepartureDate-month': '8',
        'tripDepartureDate-year': '2025'
      }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/trip-return-date')
  })

  test('Should redirect back to check your answers when a return query is supplied', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/trip-departure-date?return=/check-answers',
      payload: {
        'tripDepartureDate-day': '31',
        'tripDepartureDate-month': '8',
        'tripDepartureDate-year': '2025'
      }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/check-answers')
  })

  test('Should re-render with an error summary when the whole date is missing', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/trip-departure-date',
      payload: {}
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('.govuk-error-summary').text()).toContain(
      'Enter the date you left for your trip'
    )
  })

  test('Should re-render preserving submitted values when only the day is missing', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/trip-departure-date',
      payload: {
        'tripDepartureDate-day': '',
        'tripDepartureDate-month': '3',
        'tripDepartureDate-year': '2025'
      }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('.govuk-error-summary').text()).toContain(
      'Date you left for your trip must include a day'
    )
    expect($('#tripDepartureDate-month').val()).toBe('3')
    expect($('#tripDepartureDate-year').val()).toBe('2025')
  })

  test('Should re-render with an error summary when the month is missing', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/trip-departure-date',
      payload: {
        'tripDepartureDate-day': '31',
        'tripDepartureDate-month': '',
        'tripDepartureDate-year': '2025'
      }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('.govuk-error-summary').text()).toContain(
      'Date you left for your trip must include a month'
    )
  })

  test('Should re-render with an error summary when the year is missing', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/trip-departure-date',
      payload: {
        'tripDepartureDate-day': '31',
        'tripDepartureDate-month': '3',
        'tripDepartureDate-year': ''
      }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('.govuk-error-summary').text()).toContain(
      'Date you left for your trip must include a year'
    )
  })

  test('Should re-render with an error summary when more than one part is missing', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/trip-departure-date',
      payload: {
        'tripDepartureDate-day': '',
        'tripDepartureDate-month': '',
        'tripDepartureDate-year': '2025'
      }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('.govuk-error-summary').text()).toContain(
      'Date you left for your trip must include a day and month'
    )
  })

  test('Should re-render with an error summary for a non-numeric day', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/trip-departure-date',
      payload: {
        'tripDepartureDate-day': 'aa',
        'tripDepartureDate-month': '3',
        'tripDepartureDate-year': '2025'
      }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('.govuk-error-summary').text()).toContain(
      'Enter a date in the correct format, for example 31 3 2019'
    )
    expect($('#tripDepartureDate-day').val()).toBe('aa')
  })

  test('Should re-render with an error summary for a non-numeric month', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/trip-departure-date',
      payload: {
        'tripDepartureDate-day': '31',
        'tripDepartureDate-month': 'March',
        'tripDepartureDate-year': '2025'
      }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('.govuk-error-summary').text()).toContain(
      'Enter a date in the correct format, for example 31 3 2019'
    )
  })

  test('Should re-render with an error summary for a non-numeric year', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/trip-departure-date',
      payload: {
        'tripDepartureDate-day': '31',
        'tripDepartureDate-month': '3',
        'tripDepartureDate-year': 'twenty'
      }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('.govuk-error-summary').text()).toContain(
      'Enter a date in the correct format, for example 31 3 2019'
    )
  })

  test('Should re-render with an error summary for a year that is not 4 digits (e.g. 1 or 90)', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/trip-departure-date',
      payload: {
        'tripDepartureDate-day': '9',
        'tripDepartureDate-month': '9',
        'tripDepartureDate-year': '90'
      }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('.govuk-error-summary').text()).toContain(
      'Enter a date in the correct format, for example 31 3 2019'
    )
  })

  test('Should re-render with an error summary for an invalid day-for-month (31 February)', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/trip-departure-date',
      payload: {
        'tripDepartureDate-day': '31',
        'tripDepartureDate-month': '2',
        'tripDepartureDate-year': '2025'
      }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('.govuk-error-summary').text()).toContain(
      'Enter a date in the correct format, for example 31 3 2019'
    )
  })

  test('Should re-render with an error summary for 29 February in a non-leap year', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/trip-departure-date',
      payload: {
        'tripDepartureDate-day': '29',
        'tripDepartureDate-month': '2',
        'tripDepartureDate-year': '2025'
      }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('.govuk-error-summary').text()).toContain(
      'Enter a date in the correct format, for example 31 3 2019'
    )
  })

  test('Should re-render with an error summary when the year is before the supported minimum (e.g. 1223)', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/trip-departure-date',
      payload: {
        'tripDepartureDate-day': '9',
        'tripDepartureDate-month': '9',
        'tripDepartureDate-year': '1223'
      }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('.govuk-error-summary').text()).toContain(
      'Date you left for your trip must be on or after 24 July 2025'
    )
  })

  test('Should re-render with an error summary when the date is in the future (e.g. year 2222)', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/trip-departure-date',
      payload: {
        'tripDepartureDate-day': '9',
        'tripDepartureDate-month': '9',
        'tripDepartureDate-year': '2222'
      }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('.govuk-error-summary').text()).toContain(
      'Date you left for your trip must be today or in the past'
    )
  })

  function postDeparture(day, month, year, { url, cookie } = {}) {
    return server.inject({
      method: 'POST',
      url: url ?? '/trip-departure-date',
      headers: cookie ? { cookie } : {},
      payload: {
        'tripDepartureDate-day': day,
        'tripDepartureDate-month': month,
        'tripDepartureDate-year': year
      }
    })
  }

  async function cookieWithReturnDate(day, month, year) {
    const response = await server.inject({
      method: 'POST',
      url: '/trip-return-date',
      payload: {
        'tripReturnDate-day': day,
        'tripReturnDate-month': month,
        'tripReturnDate-year': year
      }
    })
    return response.headers['set-cookie'][0].split(';')[0]
  }

  describe('once the 365-day window is past the launch floor', () => {
    beforeEach(() => {
      vi.setSystemTime(new Date('2026-11-16T12:00:00Z'))
    })

    test('Should accept a departure date exactly 365 days before today', async () => {
      const { statusCode, headers } = await postDeparture('16', '11', '2025')

      expect(statusCode).toBe(303)
      expect(headers.location).toBe('/trip-return-date')
    })

    test('Should reject a departure date more than 365 days before today', async () => {
      const { statusCode, result } = await postDeparture('15', '11', '2025')
      const $ = load(result)

      expect(statusCode).toBe(statusCodes.ok)
      expect($('.govuk-error-summary').text()).toContain(
        'Date you left for your trip cannot be more than 365 days in the past'
      )
    })
  })

  describe('when changing the departure date from check your answers', () => {
    const fromCheckAnswers = '/trip-departure-date?return=/check-answers'

    test('Should accept a trip of exactly 30 days', async () => {
      const cookie = await cookieWithReturnDate('30', '9', '2025')
      const { statusCode, headers } = await postDeparture('31', '8', '2025', {
        url: fromCheckAnswers,
        cookie
      })

      expect(statusCode).toBe(303)
      expect(headers.location).toBe('/check-answers')
    })

    test('Should reject a trip longer than 30 days', async () => {
      const cookie = await cookieWithReturnDate('30', '9', '2025')
      const { statusCode, result } = await postDeparture('30', '8', '2025', {
        url: fromCheckAnswers,
        cookie
      })
      const $ = load(result)

      expect(statusCode).toBe(statusCodes.ok)
      expect($('.govuk-error-summary').text()).toContain(
        'Your trip cannot be longer than 30 days'
      )
    })

    test('Should reject a departure date after the return date', async () => {
      const cookie = await cookieWithReturnDate('30', '9', '2025')
      const { statusCode, result } = await postDeparture('1', '10', '2025', {
        url: fromCheckAnswers,
        cookie
      })
      const $ = load(result)

      expect(statusCode).toBe(statusCodes.ok)
      expect($('.govuk-error-summary').text()).toContain(
        'Date you left for your trip must be the same as or before the date you returned'
      )
    })
  })
})
