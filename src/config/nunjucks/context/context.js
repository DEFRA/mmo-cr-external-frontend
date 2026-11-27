import path from 'node:path'
import { readFileSync } from 'node:fs'

import { config } from '#/config/config.js'
import { buildNavigation } from './build-navigation.js'
import { createLogger } from '#/server/common/helpers/logging/logger.js'
import { currentLanguage } from '#/server/common/helpers/i18n/language-context.js'
import { translate } from '#/server/common/helpers/i18n/translator.js'

const logger = createLogger()
const assetPath = config.get('assetPath')
const manifestPath = path.join(
  config.get('root'),
  '.public/.vite/manifest.json'
)

let viteManifest

// Links to the same page in the other language, keeping all journey query params (port step,
// gear being edited, return-to-review path, etc.). The i18n plugin stores the choice and strips ?lang.
function buildLanguageToggle(request, lang) {
  const currentPath = request?.path ?? '/'
  const otherLang = lang === 'cy' ? 'en' : 'cy'
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(request?.query ?? {})) {
    if (key === 'lang') {
      continue
    }
    for (const item of [value].flat()) {
      if (typeof item === 'string') {
        params.append(key, item)
      }
    }
  }
  params.set('lang', otherLang)

  return {
    current: lang,
    other: otherLang,
    href: `${currentPath}?${params.toString()}`
  }
}

export function context(request) {
  if (config.get('isProduction') && !viteManifest) {
    try {
      viteManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
    } catch (error) {
      logger.error(`Vite ${path.basename(manifestPath)} not found`)
    }
  }

  const lang = request?.app?.lang ?? currentLanguage()

  return {
    assetPath: `${assetPath}/assets`,
    serviceName: translate(lang, 'layout.serviceName'),
    serviceUrl: '/',
    feedbackUrl: config.get('feedbackUrl'),
    lang,
    htmlLang: lang,
    languageToggle: buildLanguageToggle(request, lang),
    navigation: buildNavigation(request),
    getAssetPath(asset) {
      if (!config.get('isProduction')) {
        return `${assetPath}/${asset}`
      }

      const viteAssetPath = viteManifest?.[asset]?.file
      return `${assetPath}/${viteAssetPath ?? asset}`
    }
  }
}
