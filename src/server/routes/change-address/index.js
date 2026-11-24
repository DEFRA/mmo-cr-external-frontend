import { t } from '#/server/common/helpers/i18n/translator.js'

const CONTACT_EMAIL = 'catchrecording@marinemanagement.org.uk'

const viewContext = () => ({
  pageTitle: t('changeAddress.title'),
  heading: t('changeAddress.title'),
  backLink: { href: '/account', text: t('header.back') },
  contactEmail: CONTACT_EMAIL
})

export const changeAddressController = {
  handler: (_request, h) => h.view('change-address/index', viewContext())
}
