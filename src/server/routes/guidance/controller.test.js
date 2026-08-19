import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#guidanceController', () => {
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
      url: '/'
    })

    expect(result).toEqual(expect.stringContaining('Guidance |'))
    expect(statusCode).toBe(statusCodes.ok)
  })

  describe('Onward links', () => {
    let $

    beforeAll(async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: '/'
      })
      $ = load(result)
    })

    test('Should link to the privacy notice', () => {
      expect($('a[href="/privacy-notice"]').text().trim()).toBe(
        'Privacy notice'
      )
    })

    test('Should render a Start now button linking to sign in', () => {
      const $startButton = $('.govuk-button[href="/sign-in"]')
      expect($startButton).toHaveLength(1)
      expect($startButton.text().trim()).toBe('Start now')
    })
  })

  describe('Shared application shell', () => {
    let $

    beforeAll(async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: '/'
      })
      $ = load(result)
    })

    test('Should compose the page title with the service name', () => {
      expect($('head > title').text().trim()).toBe(
        'Guidance | Record your catch'
      )
    })

    test('Should render the skip link as the first focusable element, targeting #main-content', () => {
      const $skipLink = $('.govuk-skip-link')
      expect($skipLink).toHaveLength(1)
      expect($skipLink.attr('href')).toBe('#main-content')
    })

    test('Should render the shared header with the service name', () => {
      expect($('.govuk-header').text()).toContain('Record your catch')
    })

    test('Should render exactly one main landmark with id main-content', () => {
      expect($('main#main-content')).toHaveLength(1)
    })

    test('Should render the shared footer', () => {
      expect($('.govuk-footer')).toHaveLength(1)
    })

    test('Should NOT render an empty Back link control', () => {
      expect($('[data-testid="app-page-navigation-back-link"]')).toHaveLength(
        0
      )
      expect($('.govuk-back-link')).toHaveLength(0)
    })

    test('Should render the page navigation row before the main landmark', () => {
      const bodyHtml = $.html()
      const navIndex = bodyHtml.indexOf('app-page-navigation')
      const mainIndex = bodyHtml.indexOf('id="main-content"')
      expect(navIndex).toBeGreaterThan(-1)
      expect(navIndex).toBeLessThan(mainIndex)
    })

    test('Should render the language selector with current language and a Cymraeg link preserving the path', () => {
      const $current = $(
        '[data-testid="app-page-navigation-language-current"]'
      )
      expect($current.attr('lang')).toBe('en')
      expect($current.text().trim()).toBe('English')

      const $cymraeg = $('[data-testid="app-page-navigation-language-link"]')
      expect($cymraeg.attr('lang')).toBe('cy')
      expect($cymraeg.attr('hreflang')).toBe('cy')
      expect($cymraeg.attr('href')).toBe('/?lang=cy')
    })

    test('Should NOT render an error summary or notification banner when none is supplied', () => {
      expect($('.govuk-error-summary')).toHaveLength(0)
      expect($('.govuk-notification-banner')).toHaveLength(0)
    })

    test('Should render the Beta phase banner', () => {
      expect($('.govuk-phase-banner')).toHaveLength(1)
      expect($('.govuk-phase-banner').text()).toContain('Beta')
    })
  })
})
