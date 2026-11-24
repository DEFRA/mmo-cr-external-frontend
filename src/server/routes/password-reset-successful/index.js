import { t } from '#/server/common/helpers/i18n/translator.js'

import { getData } from '#/server/common/data/get-data.js'

const viewContext = () => {
  const account = getData('account')
  return {
    pageTitle: t('passwordReset.sent.title'),
    heading: t('passwordReset.sent.heading'),
    backLink: { href: '/account', text: t('header.back') },
    email: account.email
  }
}

export const passwordResetSuccessfulController = {
  handler: (_request, h) =>
    h.view('password-reset-successful/index', viewContext())
}
