import { AsyncLocalStorage } from 'node:async_hooks'

import { config } from '#/config/config.js'

export const SUPPORTED_LANGUAGES = ['en', 'cy']

const languageStorage = new AsyncLocalStorage()

export function isSupportedLanguage(value) {
  return SUPPORTED_LANGUAGES.includes(value)
}

export function defaultLanguage() {
  return config.get('defaultLocale')
}

/**
 * Language for the request currently being handled. Outside a request (unit tests, start-up
 * code) this is the configured default, so callers never need a request object to translate.
 */
export function currentLanguage() {
  return languageStorage.getStore()?.lang ?? defaultLanguage()
}

export function runWithLanguage(store, callback) {
  return languageStorage.run(store, callback)
}
