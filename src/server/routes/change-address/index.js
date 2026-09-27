const CONTACT_EMAIL = 'catchrecording@marinemanagement.org.uk'

const viewContext = () => ({
  pageTitle: 'Change address',
  heading: 'Change address',
  backLink: { href: '/account', text: 'Back' },
  contactEmail: CONTACT_EMAIL
})

export const changeAddressController = {
  handler: (_request, h) => h.view('change-address/index', viewContext())
}
