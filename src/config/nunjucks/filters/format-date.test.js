import { vi } from 'vitest'

import { formatDate } from './format-date.js'

describe('#formatDate', () => {
  let originalTz

  beforeAll(() => {
    // formatDate renders in the machine's local timezone - pin to UTC so the
    // time-based assertions below don't depend on where the tests are run.
    originalTz = process.env.TZ
    process.env.TZ = 'UTC'
    vi.useFakeTimers({
      now: new Date('2023-02-01')
    })
  })

  afterAll(() => {
    vi.useRealTimers()
    process.env.TZ = originalTz
  })

  describe('With defaults', () => {
    test('Date should be in expected format', () => {
      expect(formatDate('2023-02-01T11:40:02.242Z')).toBe(
        'Wed 1st February 2023'
      )
    })
  })

  describe('With Date object', () => {
    test('Date should be in expected format', () => {
      expect(formatDate(new Date())).toBe('Wed 1st February 2023')
    })
  })

  describe('With format attribute', () => {
    test('Date should be in provided format', () => {
      expect(
        formatDate(
          '2023-02-01T11:40:02.242Z',
          "h:mm aaa 'on' EEEE do MMMM yyyy"
        )
      ).toBe('11:40 am on Wednesday 1st February 2023')
    })
  })
})
