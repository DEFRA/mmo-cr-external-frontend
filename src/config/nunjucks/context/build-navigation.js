import { isSignedIn } from '#/server/common/helpers/auth/session.js'

// Sign out changes session state, so it's a POST form rather than a plain link
// (not a trivial cross-site GET/image target); styled to match the other links.
const SIGN_OUT_HTML =
  '<form method="post" action="/sign-out" class="app-sign-out-form">' +
  '<button type="submit" class="govuk-service-navigation__link app-sign-out-form__button">Sign out</button>' +
  '</form>'

// No signed-out header design was supplied, so no navigation items are shown
// when signed out rather than inventing a signed-out menu state.
export function buildNavigation(request) {
  if (!request || !isSignedIn(request)) {
    return []
  }

  return [
    {
      text: 'Home',
      href: '/records'
    },
    {
      text: 'Your account',
      href: '/account',
      current: request?.path === '/account'
    },
    {
      html: SIGN_OUT_HTML
    }
  ]
}
