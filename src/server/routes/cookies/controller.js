import { config } from '#/config/config.js'

export const cookiesController = {
  handler(_request, h) {
    const cookieTtl = config.get('session.cookie.ttl')

    return h.view('cookies/index', {
      pageTitle: 'Cookies',
      heading: 'Cookies',
      cookieName: config.get('session.cache.name'),
      cookieExpiry: cookieTtl
        ? `${cookieTtl / 1000 / 60 / 60} hours`
        : 'When you close your browser',
      backLink: { href: '/', text: 'Back' }
    })
  }
}
