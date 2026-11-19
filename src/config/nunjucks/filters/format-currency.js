import { currentLanguage } from '#/server/common/helpers/i18n/language-context.js'

export function formatCurrency(
  value,
  locale = `${currentLanguage()}-GB`,
  currency = 'GBP'
) {
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency
  })

  return formatter.format(value)
}
