import { t } from '#/server/common/helpers/i18n/translator.js'

import { statusCodes } from '#/server/common/constants/status-codes.js'

const viewContext = () => ({
  pageTitle: t('resetPassword.title'),
  heading: t('resetPassword.title'),
  backLink: { href: '/account', text: t('header.back') }
})

export const resetPasswordController = {
  handler: (_request, h) => h.view('reset-password/index', viewContext())
}

export const resetPasswordSubmitController = {
  handler: (_request, h) =>
    h.redirect('/password-reset-successful').code(statusCodes.seeOther)
}
