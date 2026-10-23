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

    expect(result).toEqual(
      expect.stringContaining('How to record your catch |')
    )
    expect(statusCode).toBe(statusCodes.ok)
  })

  describe('Guidance content', () => {
    let $

    beforeAll(async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: '/'
      })
      $ = load(result)
    })

    test('Should render the expected heading', () => {
      expect($('[data-testid="app-heading-title"]').text().trim()).toBe(
        'How to record your catch'
      )
    })

    test('Should render the key section headings', () => {
      const headings = $('h2')
        .map((_i, el) => $(el).text().trim())
        .get()

      expect(headings).toContain('What we need from you')
      expect(headings).toContain('When to create your record')
      expect(headings).toContain('Get help with your record')
    })

    test('Should resolve each contents anchor to a real id that exists exactly once', () => {
      const $links = $('[data-testid="app-guidance-contents-link"]')
      expect($links).toHaveLength(5)

      $links.each((_i, el) => {
        const href = $(el).attr('href')
        const id = href.replace('#', '')
        expect($(`#${id}`)).toHaveLength(1)
      })
    })

    test('Should NOT render the old placeholder description', () => {
      expect($.html()).not.toContain(
        'The detailed Guidance page will be implemented in a later step.'
      )
    })
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

    test('Should render a Start now button linking to sign in', () => {
      const $startButton = $('.govuk-button[href="/sign-in"]')
      expect($startButton).toHaveLength(1)
      expect($startButton.text().trim()).toBe('Start now')
    })

    test('Should link to the Android and Apple apps', () => {
      expect(
        $('a[href^="https://play.google.com/store/apps/details"]').text().trim()
      ).toBe('Android')
      expect(
        $('a[href^="https://apps.apple.com/gb/app/record-your-catch"]')
          .text()
          .trim()
      ).toBe('Apple')
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
        'How to record your catch | Record your catch'
      )
    })

    test('Should render the skip link as the first focusable element, targeting #main-content', () => {
      const $skipLink = $('.govuk-skip-link')
      expect($skipLink).toHaveLength(1)
      expect($skipLink.attr('href')).toBe('#main-content')
    })

    test('Should render the shared header with the service name', () => {
      expect($('.govuk-service-navigation').text()).toContain(
        'Record your catch'
      )
    })

    test('Should render exactly one main landmark with id main-content', () => {
      expect($('main#main-content')).toHaveLength(1)
    })

    test('Should render the shared footer', () => {
      expect($('.govuk-footer')).toHaveLength(1)
    })

    test('Should render the Back link below the phase banner', () => {
      const $backLink = $('[data-testid="app-page-navigation-back-link"]')
      expect($backLink).toHaveLength(1)
      expect($backLink.attr('href')).toBe('/records')
      expect($backLink.text().trim()).toBe('Back')
      expect(
        $('.govuk-phase-banner').next('.app-page-navigation')
      ).toHaveLength(1)
    })

    test('Should render the page navigation row before the main landmark', () => {
      const bodyHtml = $.html()
      const navIndex = bodyHtml.indexOf('app-page-navigation')
      const mainIndex = bodyHtml.indexOf('id="main-content"')
      expect(navIndex).toBeGreaterThan(-1)
      expect(navIndex).toBeLessThan(mainIndex)
    })

    test('Should render the language selector with current language and a Cymraeg link preserving the path', () => {
      const $current = $('[data-testid="app-page-navigation-language-current"]')
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

    test('Should render Home, Your account and Sign out in the header', () => {
      const $navigation = $('.govuk-service-navigation__list')
      expect($navigation.text()).toContain('Home')
      expect($navigation.text()).toContain('Your account')
      expect($navigation.text()).toContain('Sign out')
    })
  })

  describe('Guidance design components', () => {
    let $

    beforeAll(async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: '/'
      })
      $ = load(result)
    })

    test('Should render linked department names in a full-width attribution row', () => {
      expect(
        $(
          'a[href="https://www.gov.uk/government/organisations/department-for-environment-food-rural-affairs"]'
        )
          .text()
          .trim()
      ).toBe('Department for Environment, Food & Rural Affairs')
      expect(
        $(
          'a[href="https://www.gov.uk/government/organisations/marine-management-organisation"]'
        )
          .text()
          .trim()
      ).toBe('Marine Management Organisation')
      expect($('.app-guidance-departments').is('p')).toBe(true)
      expect($('.app-guidance-departments').hasClass('govuk-body-s')).toBe(true)
      expect(
        $('.app-guidance-departments')
          .parent()
          .hasClass('govuk-grid-column-full')
      ).toBe(true)
    })

    test('Should render the applies-to-England banner', () => {
      expect($('.app-guidance-applies-to').text().trim()).toBe(
        'Applies to England'
      )
    })

    test('Should render the print button with a print icon', () => {
      expect($('[data-testid="app-guidance-print-button"]').text()).toContain(
        'Print this page'
      )
      expect(
        $('[data-testid="app-guidance-print-button"] svg[aria-hidden="true"]')
      ).toHaveLength(1)
    })

    test('Should omit the temporary privacy link from guidance while retaining the footer link', () => {
      expect($('.app-guidance')).toHaveLength(1)
      expect($('.app-guidance a[href="/privacy-notice"]')).toHaveLength(0)
      expect($('.govuk-footer a[href="/privacy-notice"]')).toHaveLength(1)
    })
  })
})
