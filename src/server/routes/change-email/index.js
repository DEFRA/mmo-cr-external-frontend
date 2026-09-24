const CONTACT_EMAIL = 'catchrecording@marinemanagement.org.uk'

const viewContext = () => ({
  pageTitle: 'Change email address',
  heading: 'Change email address',
  backLink: { href: '/account', text: 'Back' },
  contactEmail: CONTACT_EMAIL
})

export const changeEmailController = {
  handler: (_request, h) => h.view('change-email/index', viewContext())
}
