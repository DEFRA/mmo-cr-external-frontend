import { t } from '#/server/common/helpers/i18n/translator.js'

import { buildNavigation } from '#/config/nunjucks/context/build-navigation.js'

/**
 * The Catch Recording entry page.
 */
export const guidanceController = {
  handler(request, h) {
    return h.view('guidance/index', {
      pageTitle: t('web.guidance.controller.js.copy.11.1'),
      heading: t('web.guidance.controller.js.copy.12.1'),
      navigation: buildNavigation(request, { showWhenSignedOut: true }),
      backLink: {
        href: '/records',
        text: t('header.back')
      },
      showStartButton: true
    })
  }
}
