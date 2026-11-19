import { t } from '#/server/common/helpers/i18n/translator.js'

const SUMMARY_KEYS = new Map([
  ['Trips details', 'summary.tripDetails'],
  ['1. Trips details', 'summary.tripDetails.numbered'],
  ['Vessel', 'summary.vessel'],
  ['Departure date', 'summary.departureDate'],
  ['Return date', 'summary.returnDate'],
  ['Departure port', 'summary.departurePort'],
  ['Return port', 'summary.returnPort'],
  ['Statistical sub area', 'summary.statisticalSubArea'],
  ['Statistical area / sub area', 'summary.statisticalAreaLabel'],
  ['Pair fishing', 'summary.pairFishing'],
  ['Paired vessel', 'summary.pairedVessel'],
  ['Paired skipper', 'summary.pairedSkipper'],
  ['Gear used', 'summary.gearUsed'],
  ['2. Gear used', 'summary.gearUsed.numbered'],
  ['Gear', 'summary.gear'],
  ['Gear type', 'summary.gearType'],
  ['Area majority catch caught', 'summary.areaMajorityCatch'],
  ['Species caught', 'summary.speciesCaught'],
  ['3. Species caught', 'summary.speciesCaught.numbered'],
  ['Species', 'summary.species'],
  ['Weight above minimum size retained (kg)', 'summary.weightAbove'],
  ['Weight below minimum size retained (kg)', 'summary.weightBelow'],
  ['Weight legally discarded (kg)', 'summary.weightDiscarded'],
  ['Species not landed', 'summary.speciesNotLanded'],
  ['Not landed', 'summary.notLanded'],
  ['Weight kept onboard or in keep pots', 'summary.keptWeight'],
  [
    'Weight above minimum size kept onboard or in keep pots (kg)',
    'summary.keptAbove'
  ],
  [
    'Weight below minimum size kept onboard or in keep pots (kg)',
    'summary.keptBelow'
  ],
  ['Mesh size', 'summary.meshSize'],
  ['Total pots or traps hauled', 'summary.totalPotsHauled'],
  ['Total pots or traps left in water', 'summary.totalPotsInWater'],
  ['Not entered', 'summary.notEntered'],
  ['Not provided', 'summary.notProvided']
])

const CHANGE_FIELD_KEYS = new Map([
  ['vessel', 'summary.vessel'],
  ['departure date', 'summary.departureDate'],
  ['return date', 'summary.returnDate'],
  ['departure port', 'summary.departurePort'],
  ['return port', 'summary.returnPort'],
  ['statistical sub area', 'summary.statisticalSubArea'],
  ['gear', 'summary.gear'],
  ['gear type', 'summary.gearType'],
  ['species', 'summary.species'],
  ['not landed', 'summary.notLanded'],
  ['mesh size', 'summary.meshSize']
])

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
