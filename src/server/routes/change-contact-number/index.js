import { t } from '#/server/common/helpers/i18n/translator.js'

const CONTACT_EMAIL = 'catchrecording@marinemanagement.org.uk'

const viewContext = () => ({
  pageTitle: t('changeContactNumber.title'),
  heading: t('changeContactNumber.title'),
  backLink: { href: '/account', text: t('header.back') },
  contactEmail: CONTACT_EMAIL
})

export const changeContactNumberController = {
  handler: (_request, h) => h.view('change-contact-number/index', viewContext())
}
