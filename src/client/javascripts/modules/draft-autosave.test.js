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

  test('Should debounce repeated input and change events', async () => {
    document.body.innerHTML =
      '<main><form><input name="editReason" value="x"></form></main>'
    initialiseDraftAutosave()
    const input = document.querySelector('input')

    input.dispatchEvent(new Event('input', { bubbles: true }))
    await vi.advanceTimersByTimeAsync(5000)
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await vi.advanceTimersByTimeAsync(9999)
    expect(window.fetch).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)

    expect(window.fetch).toHaveBeenCalledTimes(1)
  })

  test('Should serialize repeated form fields as arrays', async () => {
    document.body.innerHTML =
      '<main><form><input name="gearIds" value="pots"><input name="gearIds" value="trawl"></form></main>'
    initialiseDraftAutosave()
    document
      .querySelector('form')
      .dispatchEvent(new Event('change', { bubbles: true }))
    await vi.advanceTimersByTimeAsync(10000)

    const [, options] = window.fetch.mock.calls.at(-1)
    expect(JSON.parse(options.body).fields.gearIds).toEqual(['pots', 'trawl'])
  })

  test('Should serialize a selected file using its name', async () => {
    document.body.innerHTML =
      '<main><form><input name="evidence" type="file"></form></main>'
    const form = document.querySelector('form')
    vi.spyOn(globalThis, 'FormData').mockImplementation(
      function FormDataMock() {
        this.forEach = (callback) => {
          callback(new File(['content'], 'evidence.txt'), 'evidence')
        }
      }
    )
    initialiseDraftAutosave()
    form.dispatchEvent(new Event('change', { bubbles: true }))
    await vi.advanceTimersByTimeAsync(10000)

    const [, options] = window.fetch.mock.calls.at(-1)
    expect(JSON.parse(options.body).fields.evidence).toBe('evidence.txt')
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

  test('Should ignore invalid JSON in localStorage', async () => {
    window.localStorage.setItem('app-draft-autosave-pending', '{')
    window.fetch = vi.fn().mockResolvedValue({ ok: true })

    await flushPendingAutosaves()

    expect(window.fetch).not.toHaveBeenCalled()
  })

  test('Should re-queue an entry when the server returns an error response', async () => {
    window.localStorage.setItem(
      'app-draft-autosave-pending',
      JSON.stringify([{ path: '/draft', fields: { answer: 'yes' } }])
    )
    window.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 })

    await flushPendingAutosaves()

    expect(
      JSON.parse(window.localStorage.getItem('app-draft-autosave-pending'))
    ).toEqual([{ path: '/draft', fields: { answer: 'yes' } }])
  })

  test('Should do nothing when no queued entries exist', async () => {
    window.fetch = vi.fn()

    await flushPendingAutosaves()

    expect(window.fetch).not.toHaveBeenCalled()
  })
})
