import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#confirmationController', () => {
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
      url: '/confirmation'
    })

    expect(result).toEqual(
      expect.stringContaining('Your catch record has been submitted |')
    )
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should render the Back link to the records page', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/confirmation'
    })
    const $ = load(result)

    expect(
      $('[data-testid="app-page-navigation-back-link"]').attr('href')
    ).toBe('/records')
  })

  test('Should render the confirmation panel with the reference number', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/confirmation'
    })
    const $ = load(result)

    expect($('.govuk-panel__title').text().trim()).toBe(
      'Your catch record has been submitted'
    )
    expect($('.govuk-panel__body').text()).toContain('A1234520260727150815')
  })

  test('Should render What happens next with the approved explanatory content', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/confirmation'
    })
    const $ = load(result)

    expect($('.govuk-heading-m').text().trim()).toBe('What happens next')
    expect($('.govuk-list--bullet li')).toHaveLength(4)
    expect($('.govuk-list--bullet').text()).toContain(
      'Your catch record has been received by the relevant fishing authority'
    )
  })

  test('Should not render any Step 02 placeholder text', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/confirmation'
    })

    expect(result).not.toContain('[data-testid="app-placeholder-description"]')
    expect(
      load(result)('[data-testid="app-placeholder-description"]')
    ).toHaveLength(0)
  })

  test('Should link to the records page', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/confirmation'
    })
    const $ = load(result)

    expect($('.govuk-button').text().trim()).toBe('View your catch records')
    expect($('.govuk-button').attr('href')).toBe('/records')
  })
})
