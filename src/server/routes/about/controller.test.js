import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#aboutController', () => {
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
      url: '/about'
    })

    expect(result).toEqual(expect.stringContaining('About |'))
    expect(statusCode).toBe(statusCodes.ok)
  })

  describe('Shared application shell', () => {
    let $

    beforeAll(async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: '/about'
      })
      $ = load(result)
    })

    test('Should render the Back link with the expected href and text', () => {
      const $backLink = $('[data-testid="app-page-navigation-back-link"]')
      expect($backLink).toHaveLength(1)
      expect($backLink.attr('href')).toBe('/')
      expect($backLink.text().trim()).toBe('Back')
    })

    test('Should render the Back link before the main landmark', () => {
      const bodyHtml = $.html()
      const backLinkIndex = bodyHtml.indexOf('app-page-navigation-back-link')
      const mainIndex = bodyHtml.indexOf('id="main-content"')
      expect(backLinkIndex).toBeGreaterThan(-1)
      expect(backLinkIndex).toBeLessThan(mainIndex)
    })

    test('Should preserve the current route path in the Cymraeg language link', () => {
      expect(
        $('[data-testid="app-page-navigation-language-link"]').attr('href')
      ).toBe('/about?lang=cy')
    })
  })
})

