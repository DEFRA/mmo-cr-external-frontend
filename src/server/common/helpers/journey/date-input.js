// Structural + business-rule validation for a GOV.UK date-input day/month/year triple.
const MONTHS_IN_YEAR = 12

function isMissing(value) {
  return value === undefined || value === null || String(value).trim() === ''
}

function isNumeric(value) {
  return /^-?\d+$/.test(String(value).trim())
}

function isYearFormatValid(value) {
  return /^\d{4}$/.test(String(value).trim())
}

function toIsoDate(dayNum, monthNum, yearNum) {
  return `${String(yearNum).padStart(4, '0')}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
}

// Numeric form of an ISO date (e.g. '2025-07-24' -> 20250724) so bounds are compared as numbers, not strings.
function isoDateValue(isoDate) {
  return Number(isoDate.replaceAll('-', ''))
}

// Uses the UTC Date constructor's own calendar rules (leap years, month lengths) rather than
// reimplementing them - an out-of-range day/month rolls over into a different date, which is
// detected by the roundtrip year/month/day comparison below.
function isValidCalendarDate(dayNum, monthNum, yearNum) {
  if (monthNum < 1 || monthNum > MONTHS_IN_YEAR) {
    return false
  }

  const date = new Date(Date.UTC(yearNum, monthNum - 1, dayNum))

  return (
    date.getUTCFullYear() === yearNum &&
    date.getUTCMonth() === monthNum - 1 &&
    date.getUTCDate() === dayNum
  )
}

export function formatIsoDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number)
  const monthName = new Date(Date.UTC(year, month - 1, day)).toLocaleString(
    'en-GB',
    { month: 'long', timeZone: 'UTC' }
  )
  return `${day} ${monthName} ${year}`
}

export function todayIsoDate() {
  const now = new Date()
  return toIsoDate(
    now.getUTCDate(),
    now.getUTCMonth() + 1,
    now.getUTCFullYear()
  )
}

function checkMissingFields(values, options) {
  const missingParts = ['day', 'month', 'year'].filter((part) =>
    isMissing(values[part])
  )

  if (missingParts.length === 3) {
    return {
      isValid: false,
      errorMessage: `Enter ${options.subject}`,
      fieldErrors: { day: true, month: true, year: true },
      values
    }
  }

  if (missingParts.length > 0) {
    return {
      isValid: false,
      errorMessage: `Enter the ${missingParts.join(' and ')} ${options.subjectSuffix}`,
      fieldErrors: {
        day: missingParts.includes('day'),
        month: missingParts.includes('month'),
        year: missingParts.includes('year')
      },
      values
    }
  }

  return null
}

function checkFormat(values, options) {
  const { day, month, year } = values
  const formatMessage = options.formatMessage ?? 'Date must be a real date'

  if (isNumeric(day) && isNumeric(month) && isYearFormatValid(year)) {
    return null
  }

  return {
    isValid: false,
    errorMessage: formatMessage,
    fieldErrors: {
      day: !isNumeric(day),
      month: !isNumeric(month),
      year: !isYearFormatValid(year)
    },
    values
  }
}

function checkRealDate(values, options) {
  const dayNum = Number(values.day)
  const monthNum = Number(values.month)
  const yearNum = Number(values.year)
  const monthValid = monthNum >= 1 && monthNum <= MONTHS_IN_YEAR
  const dayValid = monthValid && isValidCalendarDate(dayNum, monthNum, yearNum)
  const formatMessage = options.formatMessage ?? 'Date must be a real date'

  if (monthValid && dayValid) {
    return null
  }

  return {
    isValid: false,
    errorMessage: formatMessage,
    fieldErrors: { day: !dayValid, month: !monthValid, year: false },
    values
  }
}

function checkBounds(isoDate, values, options) {
  const {
    minDate,
    minDateMessage,
    maxDate = todayIsoDate(),
    maxDateMessage,
    notBeforeDate,
    notBeforeMessage
  } = options
  const isoValue = isoDateValue(isoDate)
  const fieldErrors = { day: true, month: true, year: true }

  if (minDate && isoValue < isoDateValue(minDate)) {
    return { isValid: false, errorMessage: minDateMessage, fieldErrors, values }
  }

  if (maxDate && isoValue > isoDateValue(maxDate)) {
    return { isValid: false, errorMessage: maxDateMessage, fieldErrors, values }
  }

  if (notBeforeDate && isoValue < isoDateValue(notBeforeDate)) {
    return {
      isValid: false,
      errorMessage: notBeforeMessage,
      fieldErrors,
      values
    }
  }

  return null
}

/**
 * Validates a GOV.UK date-input day/month/year triple.
 * @param {{day: string, month: string, year: string}} parts
 * @param {string} _fieldPrefix the govukDateInput namePrefix/id used for this field (unused, kept for call-site clarity)
 * @param {object} options
 * @param {string} options.subject phrase used in the "Enter <subject>" all-missing message
 * @param {string} options.subjectSuffix phrase appended to per-field missing messages
 *   (e.g. "Enter the day <subjectSuffix>")
 * @param {string} [options.formatMessage] message shown when the date isn't a real date
 * @param {string} [options.minDate] earliest allowed ISO date (inclusive)
 * @param {string} [options.minDateMessage] message shown when the date is before minDate
 * @param {string} [options.maxDate] latest allowed ISO date (inclusive), defaults to today
 * @param {string} [options.maxDateMessage] message shown when the date is after maxDate
 * @param {string} [options.notBeforeDate] another ISO date this one must not be earlier than
 * @param {string} [options.notBeforeMessage] message shown when earlier than notBeforeDate
 */
export function validateDateInput({ day, month, year }, _fieldPrefix, options) {
  const values = { day, month, year }

  const result =
    checkMissingFields(values, options) ||
    checkFormat(values, options) ||
    checkRealDate(values, options)

  if (result) {
    return result
  }

  const isoDate = toIsoDate(Number(day), Number(month), Number(year))
  const boundsResult = checkBounds(isoDate, values, options)

  return boundsResult || { isValid: true, isoDate }
}
