import path from 'node:path'
import { readFileSync } from 'node:fs'

import { config } from '#/config/config.js'
import { buildNavigation } from './build-navigation.js'
import { createLogger } from '#/server/common/helpers/logging/logger.js'

const logger = createLogger()
const assetPath = config.get('assetPath')
const manifestPath = path.join(
  config.get('root'),
  '.public/.vite/manifest.json'
)

let viteManifest

// Non-functional integration point for a future localisation step: the Cymraeg link only
// preserves journey context and does not perform real translation/switching.
function buildLanguageToggle(request) {
  const currentPath = request?.path ?? '/'
  const params = new URLSearchParams()
  for (const key of ['gearId', 'return']) {
    if (typeof request?.query?.[key] === 'string') {
      params.set(key, request.query[key])
    }
  }
  params.set('lang', 'cy')

  return {
    current: config.get('defaultLocale'),
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

  return {
    assetPath: `${assetPath}/assets`,
    serviceName: config.get('serviceName'),
    serviceUrl: '/',
    feedbackUrl: config.get('feedbackUrl'),
    htmlLang: config.get('defaultLocale'),
    languageToggle: buildLanguageToggle(request),
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
