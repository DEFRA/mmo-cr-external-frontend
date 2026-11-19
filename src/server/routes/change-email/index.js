import { t } from '#/server/common/helpers/i18n/translator.js'

const CONTACT_EMAIL = 'catchrecording@marinemanagement.org.uk'

const viewContext = () => ({
  pageTitle: t('changeEmail.title'),
  heading: t('changeEmail.title'),
  backLink: { href: '/account', text: t('header.back') },
  contactEmail: CONTACT_EMAIL
})

export const changeEmailController = {
  handler: (_request, h) => h.view('change-email/index', viewContext())
}
