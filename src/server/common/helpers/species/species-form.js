export const ERROR_SUMMARY_TITLE = 'There is a problem'

// Strips the trailing " (CODE)" suffix, e.g. "Atlantic cod (COD)" -> "Atlantic cod".
export function speciesNameOnly(text) {
  return text.replace(/ \([^)]*\)$/, '')
}

export function speciesNameAndId(speciesOption, speciesId) {
  return `${speciesNameOnly(speciesOption.text).toLowerCase()} (${speciesId})`
}

export function normalizeSpeciesIds(rawValue) {
  if (rawValue === undefined || rawValue === '') {
    return []
  }

  return Array.isArray(rawValue) ? rawValue : [rawValue]
}

// Drops any id that isn't one of the currently-available species options,
// guarding against a tampered/stale payload referencing an unknown species.
export function filterKnownSpeciesIds(speciesIds, speciesOptions) {
  return speciesIds.filter((id) =>
    speciesOptions.some((option) => option.id === id)
  )
}

export function noSpeciesSelectedError() {
  const errorText = 'Select at least one species'

  return {
    errorSummary: {
      titleText: ERROR_SUMMARY_TITLE,
      errorList: [{ text: errorText, href: '#speciesIds' }]
    },
    fieldErrors: { speciesIds: errorText }
  }
}
