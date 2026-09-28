import { isLateSubmission } from './late-submission.js'

describe('#isLateSubmission', () => {
  const now = new Date('2026-09-28T12:00:00.000Z')

  test('Should return false when there is no return date', () => {
    expect(isLateSubmission(undefined, now)).toBe(false)
  })

  test('Should return false within 24 hours of the trip ending', () => {
    expect(isLateSubmission('2026-09-27', now)).toBe(false)
  })

  test('Should return true more than 24 hours after the trip ended', () => {
    expect(isLateSubmission('2026-09-20', now)).toBe(true)
  })
})
