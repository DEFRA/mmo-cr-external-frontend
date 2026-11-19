import nunjucks from 'nunjucks'

import { currentLanguage } from '#/server/common/helpers/i18n/language-context.js'
import {
  interpolate,
  translate
} from '#/server/common/helpers/i18n/translator.js'

const govukRebrand = true

/**
 * Translated text for the current request's language. Output is autoescaped as usual.
 */
function t(key, params) {
  return translate(currentLanguage(), key, params)
}

/**
 * Translated text that embeds markup, e.g. a sentence containing a link built with `{% set %}`.
 * The translation and plain-string params are escaped; only params explicitly marked safe in the
 * template (`{ link: linkHtml | safe }`) are inserted as HTML.
 */
function tHtml(key, params = {}) {
  const template = nunjucks.lib.escape(
    translate(currentLanguage(), key, { count: params.count })
  )
  const safeParams = Object.fromEntries(
    Object.entries(params).map(([name, value]) => [
      name,
      value instanceof nunjucks.runtime.SafeString
        ? value.toString()
        : nunjucks.lib.escape(String(value))
    ])
  )

  return new nunjucks.runtime.SafeString(interpolate(template, safeParams))
}

export { govukRebrand, t, tHtml }
