import { t } from '#/server/common/helpers/i18n/translator.js'

import { signIn } from '#/server/common/helpers/auth/session.js'

/**
 * Sign In has no real authentication in this step — Continue simply starts the
 * signed-in journey at the records list.
 */
export const signInController = {
  handler(_request, h) {
    return h.view('sign-in/index', {
      pageTitle: t('signIn.button'),
      heading: t('signIn.button'),
      backLink: {
        href: '/guidance',
        text: t('header.back')
      }
    })
  }
}

export const signInSubmitController = {
  handler(request, h) {
    signIn(request)

    return h.redirect('/records').code(303)
  }
}
