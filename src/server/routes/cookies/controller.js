import { t } from '#/server/common/helpers/i18n/translator.js'

import { config } from '#/config/config.js'

export const cookiesController = {
  handler(_request, h) {
    const cookieTtl = config.get('session.cookie.ttl')

    return h.view('cookies/index', {
      pageTitle: t('cookies.title'),
      heading: t('cookies.title'),
      cookieName: config.get('session.cache.name'),
      cookieExpiry: cookieTtl
        ? t('cookies.expiry.hours', {
            count: cookieTtl / 1000 / 60 / 60
          })
        : t('cookies.expiry.browserClose'),
      backLink: { href: '/', text: t('header.back') }
    })
  }
}
