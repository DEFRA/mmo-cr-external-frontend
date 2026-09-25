import { getData } from '#/server/common/data/get-data.js'

const viewContext = () => {
  const account = getData('account')
  return {
    pageTitle: 'A reset password email has been sent',
    heading: 'A reset password email has been sent to',
    backLink: { href: '/account', text: 'Back' },
    email: account.email
  }
}

export const passwordResetSuccessfulController = {
  handler: (_request, h) =>
    h.view('password-reset-successful/index', viewContext())
}
