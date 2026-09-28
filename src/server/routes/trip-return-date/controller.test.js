import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#tripReturnDateController', () => {
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
      url: '/trip-return-date'
    })

    expect(result).toEqual(
      expect.stringContaining('Which date did you return from your trip? |')
    )
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should render the question as the page heading with hint and Back link', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/trip-return-date'
    })
    const $ = load(result)

    expect($('head > title').text()).toEqual(
      expect.stringContaining('Which date did you return from your trip? |')
    )
    expect($('h1').text()).toContain(
      'Which date did you return from your trip?'
    )
    expect($('h1 .govuk-caption-l').text().trim()).toBe('New catch record')
    expect($('.govuk-hint').first().text().trim()).toBe(
      'For example, 31/03/2020'
    )
    expect(
      $('[data-testid="app-page-navigation-back-link"]').attr('href')
    ).toBe('/trip-departure-date')
  })

  test('Should render blank Day, Month and Year inputs', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/trip-return-date'
    })
    const $ = load(result)

    expect($('#tripReturnDate-day').val()).toBeUndefined()
    expect($('#tripReturnDate-month').val()).toBeUndefined()
    expect($('#tripReturnDate-year').val()).toBeUndefined()
  })
})

describe('#tripReturnDateSubmitController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should redirect to the departure port page on a valid date', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/trip-return-date',
      payload: {
        'tripReturnDate-day': '31',
        'tripReturnDate-month': '3',
        'tripReturnDate-year': '2020'
      }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/departure-port')
  })

  test('Should redirect back to check your answers when a return query is supplied', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/trip-return-date?return=/check-answers',
      payload: {
        'tripReturnDate-day': '31',
        'tripReturnDate-month': '3',
        'tripReturnDate-year': '2020'
      }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/check-answers')
  })

  test('Should re-render with an error summary when the whole date is missing', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/trip-return-date',
      payload: {}
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('.govuk-error-summary').text()).toContain(
      'Enter the date you returned from your trip'
    )
  })

  test('Should re-render preserving submitted values when only the day is missing', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/trip-return-date',
      payload: {
        'tripReturnDate-day': '',
        'tripReturnDate-month': '3',
        'tripReturnDate-year': '2020'
      }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('.govuk-error-summary').text()).toContain(
      'Enter the day you returned from your trip'
    )
    expect($('#tripReturnDate-month').val()).toBe('3')
    expect($('#tripReturnDate-year').val()).toBe('2020')
  })

  test('Should re-render with an error summary when the month is missing', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/trip-return-date',
      payload: {
        'tripReturnDate-day': '31',
        'tripReturnDate-month': '',
        'tripReturnDate-year': '2020'
      }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('.govuk-error-summary').text()).toContain(
      'Enter the month you returned from your trip'
    )
  })

  test('Should re-render with an error summary when the year is missing', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/trip-return-date',
      payload: {
        'tripReturnDate-day': '31',
        'tripReturnDate-month': '3',
        'tripReturnDate-year': ''
      }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('.govuk-error-summary').text()).toContain(
      'Enter the year you returned from your trip'
    )
  })

  test('Should re-render with an error summary when more than one part is missing', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/trip-return-date',
      payload: {
        'tripReturnDate-day': '',
        'tripReturnDate-month': '',
        'tripReturnDate-year': '2020'
      }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('.govuk-error-summary').text()).toContain(
      'Enter the day and month you returned from your trip'
    )
  })

  test('Should re-render with an error summary for a non-numeric day', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/trip-return-date',
      payload: {
        'tripReturnDate-day': 'aa',
        'tripReturnDate-month': '3',
        'tripReturnDate-year': '2020'
      }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('.govuk-error-summary').text()).toContain(
      'Date you returned from your trip must be in the format 31 3 2019'
    )
    expect($('#tripReturnDate-day').val()).toBe('aa')
  })

  test('Should re-render with an error summary for a non-numeric month', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/trip-return-date',
      payload: {
        'tripReturnDate-day': '31',
        'tripReturnDate-month': 'March',
        'tripReturnDate-year': '2020'
      }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('.govuk-error-summary').text()).toContain(
      'Date you returned from your trip must be in the format 31 3 2019'
    )
  })

  test('Should re-render with an error summary for a non-numeric year', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/trip-return-date',
      payload: {
        'tripReturnDate-day': '31',
        'tripReturnDate-month': '3',
        'tripReturnDate-year': 'twenty'
      }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('.govuk-error-summary').text()).toContain(
      'Date you returned from your trip must be in the format 31 3 2019'
    )
  })

  test('Should re-render with an error summary for a year that is not 4 digits (e.g. 1 or 90)', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/trip-return-date',
      payload: {
        'tripReturnDate-day': '9',
        'tripReturnDate-month': '9',
        'tripReturnDate-year': '90'
      }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('.govuk-error-summary').text()).toContain(
      'Date you returned from your trip must be in the format 31 3 2019'
    )
  })

  test('Should re-render with an error summary for an invalid day-for-month (31 February)', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/trip-return-date',
      payload: {
        'tripReturnDate-day': '31',
        'tripReturnDate-month': '2',
        'tripReturnDate-year': '2020'
      }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('.govuk-error-summary').text()).toContain(
      'Date you returned from your trip must be in the format 31 3 2019'
    )
  })

  test('Should re-render with an error summary for 29 February in a non-leap year', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/trip-return-date',
      payload: {
        'tripReturnDate-day': '29',
        'tripReturnDate-month': '2',
        'tripReturnDate-year': '2021'
      }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('.govuk-error-summary').text()).toContain(
      'Date you returned from your trip must be in the format 31 3 2019'
    )
  })

  test('Should accept 29 February in a leap year', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/trip-return-date',
      payload: {
        'tripReturnDate-day': '29',
        'tripReturnDate-month': '2',
        'tripReturnDate-year': '2020'
      }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/departure-port')
  })

  test('Should re-render with an error summary when the date is in the future (e.g. year 2222)', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/trip-return-date',
      payload: {
        'tripReturnDate-day': '9',
        'tripReturnDate-month': '9',
        'tripReturnDate-year': '2222'
      }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('.govuk-error-summary').text()).toContain(
      'Date you returned from your trip must be today or in the past'
    )
  })

  test('Should re-render with an error summary when the return date is before the departure date set in the journey', async () => {
    // A fixed number of days ago, rather than a hardcoded date, keeps this inside the
    // rolling 365-day window (BR-CAT-006) no matter when the suite is run.
    const departureDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
    const departureResponse = await server.inject({
      method: 'POST',
      url: '/trip-departure-date',
      payload: {
        'tripDepartureDate-day': String(departureDate.getUTCDate()),
        'tripDepartureDate-month': String(departureDate.getUTCMonth() + 1),
        'tripDepartureDate-year': String(departureDate.getUTCFullYear())
      }
    })
    const cookie = departureResponse.headers['set-cookie'][0].split(';')[0]

    const returnDate = new Date(Date.now() - 11 * 24 * 60 * 60 * 1000)
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/trip-return-date',
      headers: { cookie },
      payload: {
        'tripReturnDate-day': String(returnDate.getUTCDate()),
        'tripReturnDate-month': String(returnDate.getUTCMonth() + 1),
        'tripReturnDate-year': String(returnDate.getUTCFullYear())
      }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('.govuk-error-summary').text()).toContain(
      'Date you returned from your trip must be the same as or after the date you left'
    )
  })
})
