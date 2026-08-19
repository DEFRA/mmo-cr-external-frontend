import { validateDateInput } from './date-input.js'

describe('#validateDateInput', () => {
  test('Should reject when all parts are missing', () => {
    const result = validateDateInput(
      { day: '', month: '', year: '' },
      'tripDepartureDate',
      'the date you left for your trip'
    )

    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toBe('Enter the date you left for your trip')
    expect(result.fieldErrors).toEqual({ day: true, month: true, year: true })
  })

  test('Should reject when only the day is missing', () => {
    const result = validateDateInput(
      { day: '', month: '3', year: '2020' },
      'tripDepartureDate',
      'the date you left for your trip'
    )

    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toBe('Date must include a day')
    expect(result.fieldErrors).toEqual({ day: true, month: false, year: false })
  })

  test('Should reject when only the month is missing', () => {
    const result = validateDateInput(
      { day: '31', month: '', year: '2020' },
      'tripDepartureDate',
      'the date you left for your trip'
    )

    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toBe('Date must include a month')
    expect(result.fieldErrors).toEqual({ day: false, month: true, year: false })
  })

  test('Should reject when only the year is missing', () => {
    const result = validateDateInput(
      { day: '31', month: '3', year: '' },
      'tripDepartureDate',
      'the date you left for your trip'
    )

    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toBe('Date must include a year')
    expect(result.fieldErrors).toEqual({ day: false, month: false, year: true })
  })

  test('Should reject and name every missing part when more than one is missing', () => {
    const result = validateDateInput(
      { day: '', month: '', year: '2020' },
      'tripDepartureDate',
      'the date you left for your trip'
    )

    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toBe('Date must include a day and a month')
    expect(result.fieldErrors).toEqual({ day: true, month: true, year: false })
  })

  test('Should reject a non-numeric day', () => {
    const result = validateDateInput(
      { day: 'aa', month: '3', year: '2020' },
      'tripDepartureDate',
      'the date you left for your trip'
    )

    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toBe('Date must be a real date')
    expect(result.fieldErrors).toEqual({ day: true, month: false, year: false })
  })

  test('Should reject a non-numeric month', () => {
    const result = validateDateInput(
      { day: '31', month: 'March', year: '2020' },
      'tripDepartureDate',
      'the date you left for your trip'
    )

    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toBe('Date must be a real date')
    expect(result.fieldErrors).toEqual({ day: false, month: true, year: false })
  })

  test('Should reject a non-numeric year', () => {
    const result = validateDateInput(
      { day: '31', month: '3', year: 'twenty' },
      'tripDepartureDate',
      'the date you left for your trip'
    )

    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toBe('Date must be a real date')
    expect(result.fieldErrors).toEqual({ day: false, month: false, year: true })
  })

  test('Should reject a day that does not exist in the given month (31 February)', () => {
    const result = validateDateInput(
      { day: '31', month: '2', year: '2020' },
      'tripDepartureDate',
      'the date you left for your trip'
    )

    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toBe('Date must be a real date')
    expect(result.fieldErrors).toEqual({ day: true, month: false, year: false })
  })

  test('Should reject 29 February in a non-leap year', () => {
    const result = validateDateInput(
      { day: '29', month: '2', year: '2021' },
      'tripDepartureDate',
      'the date you left for your trip'
    )

    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toBe('Date must be a real date')
    expect(result.fieldErrors).toEqual({ day: true, month: false, year: false })
  })

  test('Should accept 29 February in a leap year', () => {
    const result = validateDateInput(
      { day: '29', month: '2', year: '2020' },
      'tripDepartureDate',
      'the date you left for your trip'
    )

    expect(result.isValid).toBe(true)
    expect(result.isoDate).toBe('2020-02-29')
  })

  test('Should accept a normal valid date', () => {
    const result = validateDateInput(
      { day: '31', month: '3', year: '2020' },
      'tripDepartureDate',
      'the date you left for your trip'
    )

    expect(result.isValid).toBe(true)
    expect(result.isoDate).toBe('2020-03-31')
  })
})
