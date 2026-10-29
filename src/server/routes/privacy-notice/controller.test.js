import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#privacyNoticeController', () => {
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
      url: '/privacy-notice'
    })

    expect(result).toEqual(expect.stringContaining('Privacy notice |'))
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should render the Back link to the guidance page', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/privacy-notice'
    })

    expect(result).toEqual(
      expect.stringContaining('app-page-navigation-back-link')
    )
    expect(result).toEqual(expect.stringContaining('href="/"'))
  })

  test('Should show account navigation when signed in', async () => {
    const signIn = await server.inject({ method: 'POST', url: '/sign-in' })
    const cookie = signIn.headers['set-cookie'][0].split(';')[0]
    const response = await server.inject({
      url: '/privacy-notice',
      headers: { cookie }
    })
    const $ = load(response.result)

    expect(
      $('.govuk-service-navigation a[href="/account"]').text().trim()
    ).toBe('Your account')
    expect($('form[action="/sign-out"]').attr('method')).toBe('post')
    expect($('form[action="/sign-out"] button').text().trim()).toBe('Sign out')
  })

  test('Should not offer account navigation when signed out', async () => {
    const response = await server.inject('/privacy-notice')
    const $ = load(response.result)

    expect($('.govuk-service-navigation a[href="/account"]')).toHaveLength(0)
    expect($('form[action="/sign-out"]')).toHaveLength(0)
  })

  describe('Privacy notice content', () => {
    let $

    beforeAll(async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: '/privacy-notice'
      })
      $ = load(result)
    })

    test('Should render the expected heading', () => {
      expect($('[data-testid="app-heading-title"]').text().trim()).toBe(
        'Privacy notice'
      )
    })

    test('Should keep the heading and text in the same narrow column', () => {
      const $column = $('.app-privacy-notice.govuk-grid-column-two-thirds')

      expect($column).toHaveLength(1)
      expect($column.find('h1')).toHaveLength(1)
      expect(
        $column.find('.app-heading > .govuk-grid-column-full')
      ).toHaveLength(1)
      expect($column.find('#complaints')).toHaveLength(1)
    })

    test('Should link the footer Privacy policy item to this page', () => {
      const $privacyPolicyLink = $('.govuk-footer a').filter(
        (_index, element) => $(element).text().trim() === 'Privacy policy'
      )

      expect($privacyPolicyLink).toHaveLength(1)
      expect($privacyPolicyLink.attr('href')).toBe('/privacy-notice')
    })

    test('Should render footer policy links and licence branding', () => {
      const $footer = $('footer .govuk-footer')

      expect($footer).toHaveLength(1)
      expect($footer.find('a[href="/cookies"]')).toHaveLength(0)
      expect($footer.text()).toContain('Accessibility Statement')
      expect($footer.text()).toContain('Open Government Licence v3.0')
      expect($footer.find('.govuk-footer__copyright-logo')).toHaveLength(1)
      expect($footer.find('.govuk-footer__crown')).toHaveLength(1)
    })

    test('Should render the Back link with the expected href', () => {
      const $backLink = $('[data-testid="app-page-navigation-back-link"]')
      expect($backLink).toHaveLength(1)
      expect($backLink.attr('href')).toBe('/')
    })

    test('Should render the key section headings', () => {
      const headings = $('h2')
        .map((_i, el) => $(el).text().trim())
        .get()

      expect(headings).toContain('Who collects your data')
      expect(headings).toContain('What personal data we collect')
      expect(headings).toContain('Your rights')
    })

    test('Should show the ICO website beneath the complaints text', () => {
      const $icoLink = $('a[href="https://ico.org.uk"]')
      expect($icoLink).toHaveLength(1)
      expect($icoLink.text().trim()).toBe('https://ico.org.uk')
      expect($icoLink.parent().text()).toContain(
        "Information Commissioner's Office (ICO)"
      )
    })

    test('Should NOT render the old placeholder description', () => {
      expect($.html()).not.toContain(
        'The detailed Privacy notice page will be implemented in a later step.'
      )
    })
  })
})
