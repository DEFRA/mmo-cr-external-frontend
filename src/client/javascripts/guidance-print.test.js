import { vi } from 'vitest'

import { initialiseGuidancePrintButton } from './guidance-print.js'

describe('Guidance print button', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('Should print the page when the button is clicked', () => {
    const listeners = {}
    const printButton = {
      addEventListener: vi.fn((event, listener) => {
        listeners[event] = listener
      })
    }
    const print = vi.fn()
    vi.stubGlobal('document', {
      querySelector: vi.fn().mockReturnValue(printButton)
    })
    vi.stubGlobal('window', { print })

    initialiseGuidancePrintButton()
    listeners.click()

    expect(print).toHaveBeenCalledOnce()
  })

  test('Should do nothing when the page has no print button', () => {
    vi.stubGlobal('document', {
      querySelector: vi.fn().mockReturnValue(null)
    })
    vi.stubGlobal('window', { print: vi.fn() })

    expect(() => initialiseGuidancePrintButton()).not.toThrow()
  })
})
