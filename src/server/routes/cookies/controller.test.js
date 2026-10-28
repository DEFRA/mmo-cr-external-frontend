import { load } from 'cheerio'

import { config } from '#/config/config.js'
import { createServer } from '#/server/server.js'

describe('Cookies page', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should describe the configured essential session cookie without signing in', async () => {
    const response = await server.inject('/cookies')
    const $ = load(response.result)

    expect(response.statusCode).toBe(200)
    expect($('h1').text().trim()).toBe('Cookies')
    expect($('table').text()).toContain(config.get('session.cache.name'))
    expect($('table').text()).toContain(
      `${config.get('session.cookie.ttl') / 1000 / 60 / 60} hours`
    )
    expect($('main a[href="/privacy-notice"]')).toHaveLength(1)
    expect($('footer')).toHaveLength(1)
    expect(response.headers['set-cookie']).toBeUndefined()
  })

  test('Should describe a session cookie without a fixed expiry', async () => {
    const cookieTtl = config.get('session.cookie.ttl')
    config.set('session.cookie.ttl', 0)

    try {
      const response = await server.inject('/cookies')
      const $ = load(response.result)

      expect($('table').text()).toContain('When you close your browser')
    } finally {
      config.set('session.cookie.ttl', cookieTtl)
    }
  })
})
