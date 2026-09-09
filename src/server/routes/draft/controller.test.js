import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import { getData } from '#/server/common/data/get-data.js'

describe('#draftController', () => {
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
      url: '/draft'
    })

    expect(result).toEqual(
      expect.stringContaining(
        'What do you want to do with your draft record? |'
      )
    )
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should render the question as the page heading', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/draft'
    })
    const $ = load(result)

    expect($('h1').text()).toContain(
      'What do you want to do with your draft record?'
    )
    expect($('h1 .govuk-caption-l').text().trim()).toBe('New catch record')
  })

  test('Should render the Back link to the records page', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/draft'
    })
    const $ = load(result)

    expect(
      $('[data-testid="app-page-navigation-back-link"]').attr('href')
    ).toBe('/records')
  })

  test('Should render both draft actions as a single radio group', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/draft'
    })
    const $ = load(result)
    const radios = $('input[type="radio"]')

    expect(radios).toHaveLength(2)
    expect(radios.eq(0).attr('name')).toBe('draftAction')
    expect(radios.eq(1).attr('name')).toBe('draftAction')
    expect(radios.eq(0).attr('value')).toBe('complete')
    expect(radios.eq(1).attr('value')).toBe('delete')
    expect($('label').eq(0).text().trim()).toBe('Complete catch record')
    expect($('label').eq(1).text().trim()).toBe('Delete catch record')
  })

  test('Should render the Save and continue button', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/draft'
    })
    const $ = load(result)

    expect($('.govuk-button').text().trim()).toBe('Save and continue')
  })

  test('Should not render any placeholder description text', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/draft'
    })
    const $ = load(result)

    expect($('[data-testid="app-placeholder-description"]')).toHaveLength(0)
  })
})

describe('#draftSubmitController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should redirect to select vessel when completing the record', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/draft',
      payload: { draftAction: 'complete' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/select-vessel')
  })

  test('Should redirect to the Empty Page when deleting the record', async () => {
    const beforeRecords = getData('allRecords')

    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/draft',
      payload: { draftAction: 'delete' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/not-implemented?return=/draft')
    expect(getData('allRecords')).toEqual(beforeRecords)
  })

  test('Should reject an unknown draft action', async () => {
    const { statusCode } = await server.inject({
      method: 'POST',
      url: '/draft',
      payload: { draftAction: 'archive' }
    })

    expect(statusCode).toBe(statusCodes.badRequest)
  })

  test('Should reject a missing draft action', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/draft',
      payload: {}
    })

    expect(statusCode).toBe(statusCodes.badRequest)
    const $ = load(result)
    expect($('.govuk-error-summary').text()).toContain(
      'Select what you want to do with this draft record'
    )
    expect($('.govuk-error-message').text()).toContain(
      'Select what you want to do with this draft record'
    )
  })
})
