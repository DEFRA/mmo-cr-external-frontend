import { describe, expect, test, vi } from 'vitest'

import { forEachSequentially } from './sequential.js'

describe('forEachSequentially', () => {
  test('runs actions in order, one at a time', async () => {
    const calls = []
    await forEachSequentially([1, 2, 3], async (item) => {
      calls.push(`start-${item}`)
      await Promise.resolve()
      calls.push(`end-${item}`)
    })
    expect(calls).toEqual([
      'start-1',
      'end-1',
      'start-2',
      'end-2',
      'start-3',
      'end-3'
    ])
  })

  test('stops at the first failure', async () => {
    const action = vi.fn(async (item) => {
      if (item === 2) {
        throw new Error('failed')
      }
    })
    await expect(forEachSequentially([1, 2, 3], action)).rejects.toThrow(
      'failed'
    )
    expect(action).toHaveBeenCalledTimes(2)
  })
})
