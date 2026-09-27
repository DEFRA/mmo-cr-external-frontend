import { isValidWeight, validateWeight } from './weight-validation.js'

describe('#validateWeight', () => {
  test('Should reject an empty value as missing', () => {
    expect(validateWeight('')).toEqual({ valid: false, reason: 'missing' })
  })

  test('Should reject a whitespace-only value as missing', () => {
    expect(validateWeight('   ')).toEqual({ valid: false, reason: 'missing' })
  })

  test('Should reject a non-numeric value', () => {
    expect(validateWeight('A1')).toEqual({
      valid: false,
      reason: 'notANumber'
    })
  })

  test('Should reject a negative value', () => {
    expect(validateWeight('-8')).toEqual({ valid: false, reason: 'negative' })
  })

  test('Should reject a value of 0', () => {
    expect(validateWeight('0')).toEqual({ valid: false, reason: 'zero' })
  })

  test('Should reject a value with more than one decimal place', () => {
    expect(validateWeight('10.55')).toEqual({
      valid: false,
      reason: 'tooManyDecimals'
    })
  })

  test('Should reject a value over 10,000', () => {
    expect(validateWeight('10000.1')).toEqual({
      valid: false,
      reason: 'tooLarge'
    })
  })

  test('Should accept a whole number', () => {
    expect(validateWeight('12')).toEqual({ valid: true, reason: null })
  })

  test('Should accept a value with one decimal place', () => {
    expect(validateWeight('12.3')).toEqual({ valid: true, reason: null })
  })

  test('Should accept a value of exactly 10,000', () => {
    expect(validateWeight('10000')).toEqual({ valid: true, reason: null })
  })

  test('Should accept a value with surrounding whitespace', () => {
    expect(validateWeight('  12.3  ')).toEqual({ valid: true, reason: null })
  })
})

describe('#isValidWeight', () => {
  test('Should return true for a valid weight', () => {
    expect(isValidWeight('12.3')).toBe(true)
  })

  test('Should return false for an invalid weight', () => {
    expect(isValidWeight('0')).toBe(false)
  })

  test('Should return false for a missing weight', () => {
    expect(isValidWeight('')).toBe(false)
  })
})
