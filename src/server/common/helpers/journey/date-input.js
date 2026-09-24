// Structural + business-rule validation for a GOV.UK date-input day/month/year triple.
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function daysInMonth(month, year) {
  if (month === 2 && isLeapYear(year)) {
    return 29
  }
  return MONTH_DAYS[month - 1]
}

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

export function formatIsoDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return `${day} ${MONTH_NAMES[month - 1]} ${year}`
}

export function todayIsoDate() {
  const now = new Date()
  return toIsoDate(
    now.getUTCDate(),
    now.getUTCMonth() + 1,
    now.getUTCFullYear()
  )
}

/**
 * Validates a GOV.UK date-input day/month/year triple.
 * @param {{day: string, month: string, year: string}} parts
 * @param {string} fieldPrefix the govukDateInput namePrefix/id used for this field
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
export function validateDateInput({ day, month, year }, fieldPrefix, options) {
  const {
    subject,
    subjectSuffix,
    formatMessage = 'Date must be a real date',
    minDate,
    minDateMessage,
    maxDate = todayIsoDate(),
    maxDateMessage,
    notBeforeDate,
    notBeforeMessage
  } = options

  const values = { day, month, year }
  const missingParts = ['day', 'month', 'year'].filter((part) =>
    isMissing(values[part])
  )

  if (missingParts.length === 3) {
    return {
      isValid: false,
      errorMessage: `Enter ${subject}`,
      fieldErrors: { day: true, month: true, year: true },
      values
    }
  }

  if (missingParts.length > 0) {
    return {
      isValid: false,
      errorMessage: `Enter the ${missingParts.join(' and ')} ${subjectSuffix}`,
      fieldErrors: {
        day: missingParts.includes('day'),
        month: missingParts.includes('month'),
        year: missingParts.includes('year')
      },
      values
    }
  }

  if (!isNumeric(day) || !isNumeric(month) || !isYearFormatValid(year)) {
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

  const dayNum = Number(day)
  const monthNum = Number(month)
  const yearNum = Number(year)
  const monthValid = monthNum >= 1 && monthNum <= 12
  const dayValid =
    monthValid && dayNum >= 1 && dayNum <= daysInMonth(monthNum, yearNum)

  if (!monthValid || !dayValid) {
    return {
      isValid: false,
      errorMessage: formatMessage,
      fieldErrors: { day: !dayValid, month: !monthValid, year: false },
      values
    }
  }

  const isoDate = toIsoDate(dayNum, monthNum, yearNum)

  if (minDate && isoDate < minDate) {
    return {
      isValid: false,
      errorMessage: minDateMessage,
      fieldErrors: { day: true, month: true, year: true },
      values
    }
  }

  if (maxDate && isoDate > maxDate) {
    return {
      isValid: false,
      errorMessage: maxDateMessage,
      fieldErrors: { day: true, month: true, year: true },
      values
    }
  }

  if (notBeforeDate && isoDate < notBeforeDate) {
    return {
      isValid: false,
      errorMessage: notBeforeMessage,
      fieldErrors: { day: true, month: true, year: true },
      values
    }
  }

  return { isValid: true, isoDate }
}
