import { t } from '#/server/common/helpers/i18n/translator.js'

export const privacyNoticeController = {
  handler(_request, h) {
    return h.view('privacy-notice/index', {
      pageTitle: t('privacyNotice.title'),
      heading: t('privacyNotice.title'),
      backLink: {
        href: '/',
        text: t('header.back')
      }
    })
  }
}
