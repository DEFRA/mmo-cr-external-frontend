function genericInvalidMessage(numericValue) {
  const isNumber = Number.isFinite(numericValue)
  const isWhole = isNumber && Number.isInteger(numericValue)
  const isPositive = isNumber && numericValue > 0

  if (isWhole) {
    return 'Enter a number greater than 0'
  }

  return isPositive
    ? 'Enter a whole number'
    : 'Enter a whole number greater than 0'
}

export function isBlankMeasurement(rawValue) {
  return (
    rawValue === undefined ||
    rawValue === null ||
    String(rawValue).trim() === ''
  )
}

/**
 * Validates a single gear measurement as a mandatory whole number greater than 0.
 * @returns {{ value?: number, error?: string }}
 */
export function validateMeasurement(rawValue, measurement) {
  if (isBlankMeasurement(rawValue)) {
    return { error: measurement.emptyMessage }
  }

  const numericValue = Number(String(rawValue).trim())

  if (Number.isInteger(numericValue) && numericValue > 0) {
    return { value: numericValue }
  }

  return {
    error: measurement.invalidMessage || genericInvalidMessage(numericValue)
  }
}
