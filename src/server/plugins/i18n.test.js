import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#i18n plugin', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should render pages in English by default', async () => {
    const { result } = await server.inject({ method: 'GET', url: '/' })

    expect(result).toContain('<html lang="en"')
    expect(result).toContain('Skip to main content')
  })

  test('Should save the chosen language and redirect without the lang parameter', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: '/cookies?lang=cy&return=%2Fcheck-answers'
    })

    expect(statusCode).toBe(statusCodes.found)
    expect(headers.location).toBe('/cookies?return=%2Fcheck-answers')
    expect(headers['set-cookie'][0]).toMatch(/^lang=cy;/)
  })

  test('Should render later requests in the saved language', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/cookies',
      headers: { cookie: 'lang=cy' }
    })

    expect(result).toContain('<html lang="cy"')
    expect(result).toContain('Neidio i&#39;r prif gynnwys')
    expect(result).toContain('data-testid="app-page-navigation-language-link"')
    expect(result).toContain('href="/cookies?lang=en"')
  })

  test('Should render error pages in the saved language', async () => {
    const { statusCode, result } = await server.inject({
      method: 'GET',
      url: '/does-not-exist',
      headers: { cookie: 'lang=cy' }
    })

    expect(statusCode).toBe(statusCodes.notFound)
    expect(result).toContain('<html lang="cy"')
    expect(result).toContain('Heb ddod o hyd i&#39;r dudalen')
  })

  test('Should ignore an unsupported language', async () => {
    const { statusCode, result } = await server.inject({
      method: 'GET',
      url: '/cookies?lang=fr',
      headers: { cookie: 'lang=xx' }
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain('<html lang="en"')
  })
})
