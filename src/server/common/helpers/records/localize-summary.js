import { readFileSync } from 'node:fs'
import path from 'node:path'

import { t } from '#/server/common/helpers/i18n/translator.js'

const { labels, changeFieldLabels } = JSON.parse(
  readFileSync(path.join(import.meta.dirname, 'summary-labels.json'), 'utf-8')
)

const SUMMARY_KEYS = new Map(Object.entries(labels))

// Change links use the lower-cased row label as their hidden text.
const CHANGE_FIELD_KEYS = new Map(
  changeFieldLabels.map((label) => [label.toLowerCase(), labels[label]])
)

const CODED_WEIGHT_KEYS = [
  ['Weight above minimum size retained', 'summary.weightAboveCode'],
  ['Weight below minimum size retained', 'summary.weightBelowCode'],
  ['Weight legally discard', 'summary.weightDiscardedCode']
]

// Returns the text inside a trailing " (…)" when `value` is exactly `prefix (…)`.
function bracketedSuffix(value, prefix) {
  const start = `${prefix} (`
  return value.startsWith(start) && value.endsWith(')')
    ? value.slice(start.length, -1)
    : null
}

function translatedLabel(value) {
  const summaryKey = SUMMARY_KEYS.get(value)
  if (summaryKey) {
    return t(summaryKey)
  }

  const gear = bracketedSuffix(value, 'Statistical sub area')
  if (gear) {
    return t('summary.statisticalSubAreaForGear', { gear })
  }

  const speciesCode = bracketedSuffix(value, 'Species')
  if (speciesCode) {
    return t('summary.speciesWithCode', { code: speciesCode })
  }

  for (const [prefix, weightKey] of CODED_WEIGHT_KEYS) {
    const weightCode = bracketedSuffix(value, prefix)
    if (weightCode) {
      return t(weightKey, { code: weightCode })
    }
  }

  return value
}

function localizeAction(action) {
  const localized = { ...action }
  if (localized.text === 'Change') {
    localized.text = t('common.change')
  }
  if (typeof localized.visuallyHiddenText === 'string') {
    const key = CHANGE_FIELD_KEYS.get(localized.visuallyHiddenText)
    if (key) {
      localized.visuallyHiddenText = t('summary.changeHidden', {
        field: t(key)
      })
    }
  }
  return localized
}

function localizeRow(row) {
  const localized = { ...row }

  if (localized.key?.text) {
    localized.key = {
      ...localized.key,
      text: translatedLabel(localized.key.text)
    }
  }

  if (
    localized.value &&
    (localized.value.text === 'Yes' || localized.value.text === 'No')
  ) {
    localized.value = {
      ...localized.value,
      text: t(`summary.${localized.value.text.toLowerCase()}`)
    }
  }

  if (localized.actions?.items) {
    localized.actions = {
      ...localized.actions,
      items: localized.actions.items.map(localizeAction)
    }
  }

  return localized
}

function localizeSection(section) {
  const localized = { ...section }
  if (typeof localized.heading === 'string') {
    localized.heading = translatedLabel(localized.heading)
  }
  if (localized.rows) {
    localized.rows = localized.rows.map(localizeRow)
  }
  if (localized.groups) {
    localized.groups = localized.groups.map(localizeSection)
  }
  return localized
}

export function localizeSummarySections(sections) {
  return Array.isArray(sections) ? sections.map(localizeSection) : sections
}
