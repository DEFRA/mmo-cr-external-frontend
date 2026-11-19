import { format, isDate, parseISO } from 'date-fns'
import { cy } from 'date-fns/locale'

import { currentLanguage } from '#/server/common/helpers/i18n/language-context.js'

const dateLocales = { cy }

export function formatDate(
  value,
  formattedDateStr = 'EEE do MMMM yyyy',
  lang = currentLanguage()
) {
  const date = isDate(value) ? value : parseISO(value)

  return format(date, formattedDateStr, { locale: dateLocales[lang] })
}
