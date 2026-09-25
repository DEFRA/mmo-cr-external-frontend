const CONTACT_EMAIL = 'catchrecording@marinemanagement.org.uk'

const viewContext = () => ({
  pageTitle: 'Change contact number',
  heading: 'Change contact number',
  backLink: { href: '/account', text: 'Back' },
  contactEmail: CONTACT_EMAIL
})

export const changeContactNumberController = {
  handler: (_request, h) => h.view('change-contact-number/index', viewContext())
}
