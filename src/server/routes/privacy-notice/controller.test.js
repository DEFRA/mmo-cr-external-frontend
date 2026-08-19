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

    test('Should link to the ICO with descriptive link text', () => {
      const $icoLink = $('a[href="https://ico.org.uk"]')
      expect($icoLink).toHaveLength(1)
      expect($icoLink.text().trim()).toBe(
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
