import { statusCodes } from '#/server/common/constants/status-codes.js'

const viewContext = () => ({
  pageTitle: 'Reset password',
  heading: 'Reset password',
  backLink: { href: '/account', text: 'Back' }
})

export const resetPasswordController = {
  handler: (_request, h) => h.view('reset-password/index', viewContext())
}

export const resetPasswordSubmitController = {
  handler: (_request, h) =>
    h.redirect('/password-reset-successful').code(statusCodes.seeOther)
}
