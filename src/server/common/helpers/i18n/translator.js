import path from 'node:path'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { createLogger } from '#/server/common/helpers/logging/logger.js'
import { currentLanguage } from './language-context.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export const LOCALES_DIR = path.resolve(dirname, '../../locales')

const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g

/**
 * Reads every `*.json` catalog file in `localesDir` and merges them into one map of
 * key -> entry. Each entry follows the shared iOS String Catalog shape:
 * `{ comment, en, cy: { value, state } }`. A key may only be defined once across all files.
 */
export function loadCatalog(localesDir = LOCALES_DIR) {
  const entries = new Map()

  const files = readdirSync(localesDir)
    .filter((file) => file.endsWith('.json'))
    .sort()

  for (const file of files) {
    const content = JSON.parse(
      readFileSync(path.join(localesDir, file), 'utf-8')
    )

    for (const [key, entry] of Object.entries(content)) {
      if (entries.has(key)) {
        throw new Error(
          `Duplicate translation key "${key}" in ${file} (already defined in ${entries.get(key).file})`
        )
      }
      entries.set(key, { ...entry, file })
    }
  }

  return entries
}

function welshValue(entry) {
  const value = entry.cy?.value
  return value === undefined || value === null || value === '' ? null : value
}

export function buildMessages(entries) {
  const messages = { en: {}, cy: {} }

  for (const [key, entry] of entries) {
    messages.en[key] = entry.en
    const welsh = welshValue(entry)
    if (welsh !== null) {
      messages.cy[key] = welsh
    }
  }

  return messages
}

const messages = buildMessages(loadCatalog())
const reportedMissingKeys = new Set()
const pluralRules = new Map()

function selectPluralForm(value, lang, count) {
  if (typeof value === 'string') {
    return value
  }

  if (!pluralRules.has(lang)) {
    pluralRules.set(lang, new Intl.PluralRules(lang))
  }

  const category = pluralRules.get(lang).select(Number(count ?? 0))
  return value[category] ?? value.other
}

export function interpolate(text, params = {}) {
  return text.replace(PLACEHOLDER, (match, name) =>
    params[name] === undefined || params[name] === null
      ? match
      : String(params[name])
  )
}

function reportMissingKey(key) {
  if (!reportedMissingKeys.has(key)) {
    reportedMissingKeys.add(key)
    createLogger().warn({ translationKey: key }, 'Missing translation key')
  }
}

/**
 * Translates `key` into `lang`. Missing Welsh falls back to English; a key missing from the
 * catalog entirely renders as the key itself (and is logged once) rather than failing the page.
 * Pass `count` in params to select a plural form.
 */
export function translate(lang, key, params = {}) {
  const localised = messages[lang]?.[key]
  const value = localised ?? messages.en[key]

  if (value === undefined) {
    reportMissingKey(key)
    return key
  }

  const form = selectPluralForm(
    value,
    localised === undefined ? 'en' : lang,
    params.count
  )
  return interpolate(form, params)
}

export function hasTranslation(key) {
  return Object.hasOwn(messages.en, key)
}

export function createTranslator(lang) {
  return (key, params) => translate(lang, key, params)
}

/**
 * Translates into the language of the request currently being handled.
 */
export function t(key, params) {
  return translate(currentLanguage(), key, params)
}
