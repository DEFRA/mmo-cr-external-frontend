// Structural validation only (missing/non-numeric/invalid-day-for-month/leap-year).
// No cross-field chronological comparison — that is explicitly out of scope for Step 09.
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

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

/**
 * Validates a GOV.UK date-input day/month/year triple.
 * @param {{day: string, month: string, year: string}} parts
 * @param {string} fieldPrefix the govukDateInput namePrefix/id used for this field
 * @param {string} question phrase used in the "Enter <question>" all-missing message
 */
export function validateDateInput({ day, month, year }, fieldPrefix, question) {
  const values = { day, month, year }
  const missingParts = ['day', 'month', 'year'].filter((part) =>
    isMissing(values[part])
  )

  if (missingParts.length === 3) {
    return {
      isValid: false,
      errorMessage: `Enter ${question}`,
      fieldErrors: { day: true, month: true, year: true },
      values
    }
  }

  if (missingParts.length > 0) {
    return {
      isValid: false,
      errorMessage: `Date must include a ${missingParts.join(' and a ')}`,
      fieldErrors: {
        day: missingParts.includes('day'),
        month: missingParts.includes('month'),
        year: missingParts.includes('year')
      },
      values
    }
  }

  if (!isNumeric(day) || !isNumeric(month) || !isNumeric(year)) {
    return {
      isValid: false,
      errorMessage: 'Date must be a real date',
      fieldErrors: {
        day: !isNumeric(day),
        month: !isNumeric(month),
        year: !isNumeric(year)
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
      errorMessage: 'Date must be a real date',
      fieldErrors: { day: !dayValid, month: !monthValid, year: false },
      values
    }
  }

  const isoDate = `${String(yearNum).padStart(4, '0')}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`

  return { isValid: true, isoDate }
}
