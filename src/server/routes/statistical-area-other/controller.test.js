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
        'Where was most of your catch caught using pots? |'
      )
    )
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should render the input label, hint and Back link', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/statistical-area-other'
    })
    const $ = load(result)

    expect($('input[type="radio"]')).toHaveLength(9)
    expect($('input[value="other"]').prop('checked')).toBe(true)
    expect($('label[for="alternativeStatisticalArea"]').text().trim()).toBe(
      'Statistical sub area'
    )
    expect($('#alternativeStatisticalArea-hint').text().trim()).toBe(
      'For example, 46E45'
    )
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
        alternativeStatisticalArea: '46E45'
      }
    })
    const cookie = setResponse.headers['set-cookie'][0].split(';')[0]

    const { result } = await server.inject({
      method: 'GET',
      url: '/statistical-area-other',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('#alternativeStatisticalArea').attr('value')).toBe('46E45')
  })

  test('Should restore a selected radio area on return to the page', async () => {
    const setResponse = await server.inject({
      method: 'POST',
      url: '/statistical-area-other',
      payload: { statisticalArea: '30f05', alternativeStatisticalArea: '' }
    })
    const cookie = setResponse.headers['set-cookie'][0].split(';')[0]

    const { result } = await server.inject({
      method: 'GET',
      url: '/statistical-area-other',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('input[value="30f05"]').prop('checked')).toBe(true)
    expect($('#alternativeStatisticalArea')).toHaveLength(0)
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

  test('Should redirect to the species selection page on a valid radio submission', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/statistical-area-other',
      payload: { statisticalArea: '30f02', alternativeStatisticalArea: '' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/species-selection')
  })

  test('Should redirect back to check your answers when a return query is supplied', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/statistical-area-other?return=/check-answers',
      payload: { statisticalArea: '30f02', alternativeStatisticalArea: '' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/check-answers')
  })

  test('Should redirect to the species selection page on a valid Other submission', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/statistical-area-other',
      payload: {
        statisticalArea: 'other',
        alternativeStatisticalArea: '46E45'
      }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/species-selection')
  })

  test('Should re-render the page with an error summary when no area is selected', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/statistical-area-other',
      payload: {}
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary')).toHaveLength(1)
    expect($('.govuk-error-summary').text()).toContain(
      'Select the area where most of your catch was caught'
    )
    expect($('.govuk-error-message')).toHaveLength(1)
  })

  test('Should re-render the page with an error summary when Other is selected without a sub area', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/statistical-area-other',
      payload: { statisticalArea: 'other', alternativeStatisticalArea: '' }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary')).toHaveLength(1)
    expect($('.govuk-error-summary').text()).toContain(
      'Enter the statistical sub area in the correct format, like 46E45'
    )
  })

  test('Should re-render the page with an error summary for an incorrectly-formatted value', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/statistical-area-other',
      payload: {
        statisticalArea: 'other',
        alternativeStatisticalArea: 'abcdef'
      }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary')).toHaveLength(1)
    expect($('.govuk-error-summary').text()).toContain(
      'Enter the statistical sub area in the correct format, like 46E45'
    )
  })

  test('Should preserve the submitted value in the input after a validation error', async () => {
    const { result } = await server.inject({
      method: 'POST',
      url: '/statistical-area-other',
      payload: {
        statisticalArea: 'other',
        alternativeStatisticalArea: 'abcdef'
      }
    })
    const $ = load(result)

    expect($('#alternativeStatisticalArea').attr('value')).toBe('abcdef')
  })
})
