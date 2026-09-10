import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#statisticalAreaOtherController', () => {
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
      url: '/statistical-area-other'
    })

    expect(result).toEqual(
      expect.stringContaining(
        'Select the statistical sub area where the majority of your catch was caught using seine nets (mesh size 100mm)? |'
      )
    )
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should render the manual entry input and Back link', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/statistical-area-other'
    })
    const $ = load(result)

    expect($('label[for="alternativeStatisticalArea"]').text().trim()).toBe(
      'Statistical sub area - For example, 46E45'
    )
    expect($('#alternativeStatisticalArea').attr('placeholder')).toBe(
      'Type to search (minimum 2 characters)'
    )
    expect($('#statistical-area-results').attr('role')).toBe('listbox')
    expect($('input[type="radio"]')).toHaveLength(10)
    expect($('input[type="radio"]:checked')).toHaveLength(0)
    expect(
      $('[data-testid="app-page-navigation-back-link"]').attr('href')
    ).toBe('/statistical-area')
  })

  test('Should pre-fill the input with a previously-saved value', async () => {
    const setResponse = await server.inject({
      method: 'POST',
      url: '/statistical-area-other',
      payload: {
        statisticalArea: 'other',
        alternativeStatisticalArea: '30F04'
      }
    })
    const cookie = setResponse.headers['set-cookie'][0].split(';')[0]

    const { result } = await server.inject({
      method: 'GET',
      url: '/statistical-area-other',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('#alternativeStatisticalArea').attr('value')).toBe('30F04')
  })
})

describe('#statisticalAreaOtherSubmitController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should redirect back to check your answers when a valid area and return query are supplied', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/statistical-area-other?return=/check-answers',
      payload: { statisticalArea: 'other', alternativeStatisticalArea: '30F02' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/check-answers')
  })

  test('Should redirect to the species selection page on a valid reference-data submission', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/statistical-area-other',
      payload: {
        statisticalArea: 'other',
        alternativeStatisticalArea: '30F04'
      }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/species-selection')
  })

  test('Should re-render the page with an error summary when no area is entered', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/statistical-area-other',
      payload: { statisticalArea: 'other' }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary')).toHaveLength(1)
    expect($('.govuk-error-summary').text()).toContain(
      'Enter a valid statistical sub area code.'
    )
    expect($('.govuk-error-message')).toHaveLength(1)
  })

  test('Should re-render the page with a format error for an incorrectly formatted area', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/statistical-area-other',
      payload: {
        statisticalArea: 'other',
        alternativeStatisticalArea: 'ABCDE'
      }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary')).toHaveLength(1)
    expect($('.govuk-error-summary').text()).toContain(
      'Enter a statistical subrectangle in the correct format, for example 38E84'
    )
  })

  test('Should re-render the page with an invalid-code error for an unknown area', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/statistical-area-other',
      payload: {
        statisticalArea: 'other',
        alternativeStatisticalArea: '99Z99'
      }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary').text()).toContain(
      'Enter a valid statistical sub area code.'
    )
  })

  test('Should show the selection error when no statistical subrectangle is selected', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/statistical-area-other',
      payload: {}
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary').text()).toContain(
      'Select a statistical subrectangle'
    )
    expect($('#statisticalArea-error').text()).toContain(
      'Select a statistical subrectangle'
    )
  })

  test('Should preserve the submitted value in the input after a validation error', async () => {
    const { result } = await server.inject({
      method: 'POST',
      url: '/statistical-area-other',
      payload: {
        statisticalArea: 'other',
        alternativeStatisticalArea: 'ABCDE'
      }
    })
    const $ = load(result)

    expect($('#alternativeStatisticalArea').attr('value')).toBe('ABCDE')
  })
})
