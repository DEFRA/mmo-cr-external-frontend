import { t } from '#/server/common/helpers/i18n/translator.js'

const viewContext = () => ({
  pageTitle: t('changeVesselOwner.title'),
  heading: t('changeVesselOwner.title'),
  backLink: { href: '/account', text: t('header.back') }
})

export const changeVesselOwnerController = {
  handler: (_request, h) => h.view('change-vessel-owner/index', viewContext())
}
