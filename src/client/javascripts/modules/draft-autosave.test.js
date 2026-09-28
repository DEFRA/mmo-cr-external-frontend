// @vitest-environment jsdom
import {
  flushPendingAutosaves,
  initialiseDraftAutosave
} from './draft-autosave.js'

describe('#initialiseDraftAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    window.localStorage.clear()
    window.fetch = vi.fn().mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  test('Should do nothing when the page has no form', () => {
    document.body.innerHTML = '<main></main>'
    initialiseDraftAutosave()

    expect(window.fetch).not.toHaveBeenCalled()
  })

  test('Should autosave the form fields 10 seconds after an input event', async () => {
    document.body.innerHTML =
      '<main><form><input name="editReason" value="Corrected weight"></form></main>'
    initialiseDraftAutosave()

    document
      .querySelector('input')
      .dispatchEvent(new Event('input', { bubbles: true }))
    await vi.advanceTimersByTimeAsync(10000)

    expect(window.fetch).toHaveBeenCalledWith(
      '/draft/autosave',
      expect.objectContaining({ method: 'POST' })
    )
    const [, options] = window.fetch.mock.calls.at(-1)
    expect(JSON.parse(options.body)).toEqual({
      path: expect.any(String),
      fields: { editReason: 'Corrected weight' }
    })
  })

  test('Should queue the save in localStorage when the request fails', async () => {
    window.fetch.mockRejectedValue(new Error('network error'))
    document.body.innerHTML =
      '<main><form><input name="editReason" value="x"></form></main>'
    initialiseDraftAutosave()

    document
      .querySelector('input')
      .dispatchEvent(new Event('input', { bubbles: true }))
    await vi.advanceTimersByTimeAsync(10000)

    const pending = JSON.parse(
      window.localStorage.getItem('app-draft-autosave-pending')
    )
    expect(pending).toHaveLength(1)
  })
})

describe('#flushPendingAutosaves', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('Should retry and clear queued entries once the request succeeds', async () => {
    window.localStorage.setItem(
      'app-draft-autosave-pending',
      JSON.stringify([{ path: '/draft', fields: { a: '1' } }])
    )
    window.fetch = vi.fn().mockResolvedValue({ ok: true })

    await flushPendingAutosaves()

    expect(window.fetch).toHaveBeenCalledTimes(1)
    expect(window.localStorage.getItem('app-draft-autosave-pending')).toBe('[]')
  })
})
