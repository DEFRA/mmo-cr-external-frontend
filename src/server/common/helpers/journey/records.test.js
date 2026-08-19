import { resolveRecordDestination } from './records.js'

describe('#resolveRecordDestination', () => {
  test('Should route an unsent record to the draft page', () => {
    expect(resolveRecordDestination('unsent')).toBe('draft')
  })

  test('Should route a submitted record to the details page', () => {
    expect(resolveRecordDestination('submitted')).toBe('details')
  })

  test('Should route an amended record to the details page', () => {
    expect(resolveRecordDestination('amended')).toBe('details')
  })

  test('Should route a late record to the details page', () => {
    expect(resolveRecordDestination('late')).toBe('details')
  })

  test('Should throw for an unknown status', () => {
    expect(() => resolveRecordDestination('unknown')).toThrow(
      'Unknown record status: unknown'
    )
  })
})
