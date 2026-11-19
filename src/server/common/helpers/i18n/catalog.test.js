import path from 'node:path'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { loadCatalog } from './translator.js'

const srcDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../..'
)
const catalog = loadCatalog()
const REVIEW_STATES = ['new', 'needs_review', 'translated']
const PLURAL_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other']
const KEY_USAGE = /\b(?:t|tHtml)\(\s*['"]([A-Za-z0-9_.-]+)['"]/g

function placeholders(value) {
  const texts = typeof value === 'string' ? [value] : Object.values(value)
  return [
    ...new Set(
      texts.flatMap((text) =>
        [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((match) => match[1])
      )
    )
  ].sort()
}

function isMessage(value) {
  if (typeof value === 'string') {
    return value.length > 0
  }
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.other === 'string' &&
    Object.keys(value).every((category) => PLURAL_CATEGORIES.includes(category))
  )
}

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const file = path.join(dir, name)
    if (statSync(file).isDirectory()) {
      return sourceFiles(file)
    }
    return /\.(js|njk)$/.test(name) && !name.endsWith('.test.js') ? [file] : []
  })
}

describe('Translation catalog', () => {
  const entries = [...catalog.entries()]

  test.each(entries)('%s has a valid English and Welsh entry', (key, entry) => {
    expect(typeof entry.comment).toBe('string')
    expect(isMessage(entry.en)).toBe(true)
    expect(REVIEW_STATES).toContain(entry.cy?.state)

    if (entry.cy.state !== 'new') {
      expect(isMessage(entry.cy.value)).toBe(true)
      expect(placeholders(entry.cy.value)).toEqual(placeholders(entry.en))
    }
  })

  test('Should never show review markers in translated text', () => {
    const marked = entries.filter(([, entry]) =>
      JSON.stringify([entry.en, entry.cy?.value]).includes('CY-TODO')
    )

    expect(marked.map(([key]) => key)).toEqual([])
  })

  test('Should define every key used in templates and server code', () => {
    const missing = sourceFiles(srcDir).flatMap((file) =>
      [...readFileSync(file, 'utf-8').matchAll(KEY_USAGE)]
        .map((match) => match[1])
        .filter((key) => !catalog.has(key))
        .map((key) => `${path.relative(srcDir, file)}: ${key}`)
    )

    expect(missing).toEqual([])
  })
})
