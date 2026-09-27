import { validateDateInput, formatIsoDate } from './date-input.js'

const departureOptions = {
  subject: 'the date you left for your trip',
  subjectSuffix: 'you left for your trip',
  formatMessage: 'Enter a date in the correct format, for example 31 3 2019',
  minDate: '2025-07-24',
  minDateMessage:
    'Date you left for your trip must be on or after 24 July 2025',
  maxDate: '2026-01-01',
  maxDateMessage: 'Date you left for your trip must be today or in the past'
}

describe('#validateDateInput', () => {
  test('Should reject when all parts are missing', () => {
    const result = validateDateInput(
      { day: '', month: '', year: '' },
      'tripDepartureDate',
      departureOptions
    )

    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toBe('Enter the date you left for your trip')
    expect(result.fieldErrors).toEqual({ day: true, month: true, year: true })
  })

  test('Should reject when only the day is missing', () => {
    const result = validateDateInput(
      { day: '', month: '3', year: '2025' },
      'tripDepartureDate',
      departureOptions
    )

    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toBe('Enter the day you left for your trip')
    expect(result.fieldErrors).toEqual({ day: true, month: false, year: false })
  })

  test('Should reject when only the month is missing', () => {
    const result = validateDateInput(
      { day: '31', month: '', year: '2025' },
      'tripDepartureDate',
      departureOptions
    )

    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toBe('Enter the month you left for your trip')
    expect(result.fieldErrors).toEqual({ day: false, month: true, year: false })
  })

  test('Should reject when only the year is missing', () => {
    const result = validateDateInput(
      { day: '31', month: '3', year: '' },
      'tripDepartureDate',
      departureOptions
    )

    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toBe('Enter the year you left for your trip')
    expect(result.fieldErrors).toEqual({ day: false, month: false, year: true })
  })

  test('Should reject and name every missing part when more than one is missing', () => {
    const result = validateDateInput(
      { day: '', month: '', year: '2025' },
      'tripDepartureDate',
      departureOptions
    )

    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toBe(
      'Enter the day and month you left for your trip'
    )
    expect(result.fieldErrors).toEqual({ day: true, month: true, year: false })
  })

  test('Should reject a non-numeric day', () => {
    const result = validateDateInput(
      { day: 'aa', month: '3', year: '2025' },
      'tripDepartureDate',
      departureOptions
    )

    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toBe(
      'Enter a date in the correct format, for example 31 3 2019'
    )
    expect(result.fieldErrors).toEqual({ day: true, month: false, year: false })
  })

  test('Should reject a non-numeric month', () => {
    const result = validateDateInput(
      { day: '31', month: 'March', year: '2025' },
      'tripDepartureDate',
      departureOptions
    )

    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toBe(
      'Enter a date in the correct format, for example 31 3 2019'
    )
    expect(result.fieldErrors).toEqual({ day: false, month: true, year: false })
  })

  test('Should reject a non-numeric year', () => {
    const result = validateDateInput(
      { day: '31', month: '3', year: 'twenty' },
      'tripDepartureDate',
      departureOptions
    )

    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toBe(
      'Enter a date in the correct format, for example 31 3 2019'
    )
    expect(result.fieldErrors).toEqual({ day: false, month: false, year: true })
  })

  test('Should reject a year that is not exactly 4 digits', () => {
    const result = validateDateInput(
      { day: '9', month: '9', year: '1' },
      'tripDepartureDate',
      departureOptions
    )

    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toBe(
      'Enter a date in the correct format, for example 31 3 2019'
    )
    expect(result.fieldErrors).toEqual({ day: false, month: false, year: true })
  })

  test('Should reject a day that does not exist in the given month (31 February)', () => {
    const result = validateDateInput(
      { day: '31', month: '2', year: '2025' },
      'tripDepartureDate',
      departureOptions
    )

    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toBe(
      'Enter a date in the correct format, for example 31 3 2019'
    )
    expect(result.fieldErrors).toEqual({ day: true, month: false, year: false })
  })

  test('Should reject 29 February in a non-leap year', () => {
    const result = validateDateInput(
      { day: '29', month: '2', year: '2025' },
      'tripDepartureDate',
      departureOptions
    )

    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toBe(
      'Enter a date in the correct format, for example 31 3 2019'
    )
    expect(result.fieldErrors).toEqual({ day: true, month: false, year: false })
  })

  test('Should reject 30 February (invalid day for any year)', () => {
    const result = validateDateInput(
      { day: '30', month: '2', year: '2028' },
      'tripDepartureDate',
      { ...departureOptions, maxDate: '2028-12-31' }
    )

    expect(result.isValid).toBe(false)
    expect(result.fieldErrors).toEqual({ day: true, month: false, year: false })
  })

  test('Should reject a day of 0', () => {
    const result = validateDateInput(
      { day: '0', month: '6', year: '2025' },
      'tripDepartureDate',
      departureOptions
    )

    expect(result.isValid).toBe(false)
    expect(result.fieldErrors).toEqual({ day: true, month: false, year: false })
  })

  test('Should reject a day of 32', () => {
    const result = validateDateInput(
      { day: '32', month: '6', year: '2025' },
      'tripDepartureDate',
      departureOptions
    )

    expect(result.isValid).toBe(false)
    expect(result.fieldErrors).toEqual({ day: true, month: false, year: false })
  })

  test('Should reject a month of 0', () => {
    const result = validateDateInput(
      { day: '15', month: '0', year: '2025' },
      'tripDepartureDate',
      departureOptions
    )

    expect(result.isValid).toBe(false)
    expect(result.fieldErrors).toEqual({ day: true, month: true, year: false })
  })

  test('Should reject a month of 13', () => {
    const result = validateDateInput(
      { day: '15', month: '13', year: '2025' },
      'tripDepartureDate',
      departureOptions
    )

    expect(result.isValid).toBe(false)
    expect(result.fieldErrors).toEqual({ day: true, month: true, year: false })
  })

  test('Should accept 29 February in a leap year', () => {
    const result = validateDateInput(
      { day: '29', month: '2', year: '2028' },
      'tripDepartureDate',
      { ...departureOptions, maxDate: '2028-12-31' }
    )

    expect(result.isValid).toBe(true)
    expect(result.isoDate).toBe('2028-02-29')
  })

  test('Should accept 29 February in a century leap year (divisible by 400)', () => {
    const result = validateDateInput(
      { day: '29', month: '2', year: '2000' },
      'tripDepartureDate',
      { ...departureOptions, minDate: undefined, maxDate: '2000-12-31' }
    )

    expect(result.isValid).toBe(true)
    expect(result.isoDate).toBe('2000-02-29')
  })

  test('Should reject 29 February in a century non-leap year (divisible by 100 but not 400)', () => {
    const result = validateDateInput(
      { day: '29', month: '2', year: '1900' },
      'tripDepartureDate',
      { ...departureOptions, minDate: undefined, maxDate: '1900-12-31' }
    )

    expect(result.isValid).toBe(false)
    expect(result.fieldErrors).toEqual({ day: true, month: false, year: false })
  })

  test('Should accept 31 December as the last day of a month', () => {
    const result = validateDateInput(
      { day: '31', month: '12', year: '2025' },
      'tripDepartureDate',
      departureOptions
    )

    expect(result.isValid).toBe(true)
    expect(result.isoDate).toBe('2025-12-31')
  })

  test('Should accept a normal valid date within range', () => {
    const result = validateDateInput(
      { day: '31', month: '8', year: '2025' },
      'tripDepartureDate',
      departureOptions
    )

    expect(result.isValid).toBe(true)
    expect(result.isoDate).toBe('2025-08-31')
  })

  test('Should reject a year before the configured minimum date (e.g. 1223)', () => {
    const result = validateDateInput(
      { day: '9', month: '9', year: '1223' },
      'tripDepartureDate',
      departureOptions
    )

    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toBe(
      'Date you left for your trip must be on or after 24 July 2025'
    )
    expect(result.fieldErrors).toEqual({ day: true, month: true, year: true })
  })

  test('Should reject a date before the configured minimum date', () => {
    const result = validateDateInput(
      { day: '1', month: '1', year: '2025' },
      'tripDepartureDate',
      departureOptions
    )

    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toBe(
      'Date you left for your trip must be on or after 24 July 2025'
    )
    expect(result.fieldErrors).toEqual({ day: true, month: true, year: true })
  })

  test('Should reject a date after the configured maximum date (e.g. 2222)', () => {
    const result = validateDateInput(
      { day: '9', month: '9', year: '2222' },
      'tripDepartureDate',
      departureOptions
    )

    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toBe(
      'Date you left for your trip must be today or in the past'
    )
    expect(result.fieldErrors).toEqual({ day: true, month: true, year: true })
  })

  test('Should reject a date after the maximum date (future)', () => {
    const result = validateDateInput(
      { day: '1', month: '1', year: '2099' },
      'tripDepartureDate',
      departureOptions
    )

    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toBe(
      'Date you left for your trip must be today or in the past'
    )
    expect(result.fieldErrors).toEqual({ day: true, month: true, year: true })
  })

  test('Should default maxDate to today when not supplied', () => {
    const { maxDate: _omit, ...optionsWithoutMaxDate } = departureOptions
    const result = validateDateInput(
      { day: '1', month: '1', year: '2099' },
      'tripDepartureDate',
      optionsWithoutMaxDate
    )

    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toBe(
      'Date you left for your trip must be today or in the past'
    )
  })

  test('Should reject a date earlier than notBeforeDate', () => {
    const result = validateDateInput(
      { day: '1', month: '8', year: '2025' },
      'tripReturnDate',
      {
        subject: 'the date you returned from your trip',
        subjectSuffix: 'you returned from your trip',
        formatMessage:
          'Date you returned from your trip must be in the format 31 3 2019',
        maxDate: '2026-01-01',
        maxDateMessage:
          'Date you returned from your trip must be today or in the past',
        notBeforeDate: '2025-08-10',
        notBeforeMessage:
          'Date you returned from your trip must be the same as or after the date you left'
      }
    )

    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toBe(
      'Date you returned from your trip must be the same as or after the date you left'
    )
    expect(result.fieldErrors).toEqual({ day: true, month: true, year: true })
  })

  test('Should accept a date on or after notBeforeDate', () => {
    const result = validateDateInput(
      { day: '10', month: '8', year: '2025' },
      'tripReturnDate',
      {
        subject: 'the date you returned from your trip',
        subjectSuffix: 'you returned from your trip',
        maxDate: '2026-01-01',
        notBeforeDate: '2025-08-10'
      }
    )

    expect(result.isValid).toBe(true)
    expect(result.isoDate).toBe('2025-08-10')
  })
})

describe('#formatIsoDate', () => {
  test('Should format an ISO date as "D Month YYYY"', () => {
    expect(formatIsoDate('2025-07-24')).toBe('24 July 2025')
  })
})
