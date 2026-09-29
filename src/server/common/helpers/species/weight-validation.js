// FR2-4 ("whole numbers only") conflicts with AC8/BR7 ("up to one decimal place, e.g.
// 10.5, but not 10.55") - resolved in favour of AC8/BR7, which is followed below.
// Format-only check for "could plausibly be a number" (optional '-', digits, optional
// decimal fraction) - business-rule bounds (range, decimal places) are applied separately.
const NUMERIC_PATTERN = /^-?\d+(\.\d+)?$/
const ONE_DECIMAL_PLACE_PATTERN = /^\d+(\.\d)?$/
const MAX_WEIGHT = 10000

export function validateWeight(rawValue) {
  if (!rawValue?.trim()) {
    return { valid: false, reason: 'missing' }
  }

  const trimmedValue = rawValue.trim()

  if (!NUMERIC_PATTERN.test(trimmedValue)) {
    return { valid: false, reason: 'notANumber' }
  }

  const numericValue = Number(trimmedValue)

  if (numericValue < 0) {
    return { valid: false, reason: 'negative' }
  }

  if (numericValue === 0) {
    return { valid: false, reason: 'zero' }
  }

  if (numericValue > MAX_WEIGHT) {
    return { valid: false, reason: 'tooLarge' }
  }

  if (!ONE_DECIMAL_PLACE_PATTERN.test(trimmedValue)) {
    return { valid: false, reason: 'tooManyDecimals' }
  }

  return { valid: true, reason: null }
}

export function isValidWeight(rawValue) {
  return validateWeight(rawValue).valid
}

export function weightErrorMessage(reason, nameAndId, missingFieldLabel) {
  switch (reason) {
    case 'missing':
      return `Enter the ${missingFieldLabel} for ${nameAndId}`
    case 'notANumber':
      return `The weight for ${nameAndId} must be a number`
    case 'negative':
    case 'zero':
      return `The weight for ${nameAndId} must be more than 0kg`
    case 'tooManyDecimals':
      return `The weight for ${nameAndId} must be a number with up to one decimal place`
    case 'tooLarge':
      return `The weight for ${nameAndId} must be 10,000kg or less`
    default:
      return null
  }
}
