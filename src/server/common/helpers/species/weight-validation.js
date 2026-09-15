// Accepts 1-4 whole digits with an optional single decimal digit, e.g. 12, 12.3, 9999.9.
const WEIGHT_PATTERN = /^\d{1,4}(\.\d)?$/
const MAX_WEIGHT = 9999.9

export function isValidWeight(rawValue) {
  if (!rawValue) {
    return false
  }

  const trimmedValue = rawValue.trim()

  if (!WEIGHT_PATTERN.test(trimmedValue)) {
    return false
  }

  const numericValue = Number(trimmedValue)

  return numericValue > 0 && numericValue <= MAX_WEIGHT
}
