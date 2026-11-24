import nunjucks from 'nunjucks'

import { isSignedIn } from '#/server/common/helpers/auth/session.js'
import { t } from '#/server/common/helpers/i18n/translator.js'

// Sign out changes session state, so it's a POST form rather than a plain link
// (not a trivial cross-site GET/image target); styled to match the other links.
function signOutHtml() {
  return (
    '<form method="post" action="/sign-out" class="app-sign-out-form">' +
    `<button type="submit" class="govuk-service-navigation__link app-sign-out-form__button">${nunjucks.lib.escape(t('layout.nav.signOut'))}</button>` +
    '</form>'
  )
}

export function buildNavigation(request) {
  if (!request || !isSignedIn(request)) {
    return []
  }

  return [
    {
      text: t('layout.nav.home'),
      href: '/records'
    },
    {
      text: t('layout.nav.account'),
      href: '/account',
      current: request?.path === '/account'
    },
    {
      html: signOutHtml()
    }
  ]
}
