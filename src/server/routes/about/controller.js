import { t } from '#/server/common/helpers/i18n/translator.js'

/**
 * A GDS styled example about page controller.
 * Provided as an example, remove or modify as required.
 */
export const aboutController = {
  handler(_request, h) {
    return h.view('about/index', {
      pageTitle: t('web.about.controller.js.copy.10.1'),
      heading: t('web.about.controller.js.copy.11.1'),
      backLink: {
        href: '/',
        text: t('header.back')
      }
    })
  }
}
