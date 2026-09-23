// @vitest-environment jsdom
import { initialiseStatisticalAreaSearch } from './statistical-area-search.js'

function setBodyHtml(html) {
  document.body.innerHTML = html
}

function baseMarkup() {
  return `
    <input data-statistical-area-search />
    <div data-statistical-area-search-panel hidden></div>
    <div data-statistical-area-options></div>
    <ul data-statistical-area-results hidden></ul>
    <p data-statistical-area-coordinates hidden>
      Coordinates: <span data-statistical-area-coordinates-value></span>
    </p>
  `
}

function mockFetchOnce(response) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(response)
    })
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('#initialiseStatisticalAreaSearch', () => {
  test('Should do nothing when there is no search input', async () => {
    setBodyHtml('<div></div>')

    await expect(initialiseStatisticalAreaSearch()).resolves.toBeUndefined()
  })

  test('Should hide results when the subrectangles request is not ok', async () => {
    setBodyHtml(baseMarkup())
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    await initialiseStatisticalAreaSearch()

    const input = document.querySelector('[data-statistical-area-search]')
    expect(input).not.toBeNull()
  })

  test('Should hide results and set map hidden state when fetch throws', async () => {
    setBodyHtml(baseMarkup())
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))

    await initialiseStatisticalAreaSearch()

    expect(
      document.querySelector('[data-statistical-area-results]').hidden
    ).toBe(true)
  })

  test('Should hide results below the minimum search length', async () => {
    setBodyHtml(baseMarkup())
    mockFetchOnce({
      subrectangles: [{ subCode: '27.7.d' }, { subCode: '27.4.b' }]
    })

    await initialiseStatisticalAreaSearch()

    const input = document.querySelector('[data-statistical-area-search]')
    input.value = '2'
    input.dispatchEvent(new Event('input'))

    expect(
      document.querySelector('[data-statistical-area-results]').hidden
    ).toBe(true)
  })

  test('Should hide results when there are no matches', async () => {
    setBodyHtml(baseMarkup())
    mockFetchOnce({ subrectangles: [{ subCode: '27.7.d' }] })

    await initialiseStatisticalAreaSearch()

    const input = document.querySelector('[data-statistical-area-search]')
    input.value = 'zz'
    input.dispatchEvent(new Event('input'))

    expect(
      document.querySelector('[data-statistical-area-results]').hidden
    ).toBe(true)
  })

  test('Should render and select a matching subrectangle', async () => {
    setBodyHtml(baseMarkup())
    mockFetchOnce({
      subrectangles: [{ subCode: '27.7.D' }, { subCode: '27.4.B' }]
    })

    await initialiseStatisticalAreaSearch()

    const input = document.querySelector('[data-statistical-area-search]')
    input.value = '27.7'
    input.dispatchEvent(new Event('input'))

    const results = document.querySelector('[data-statistical-area-results]')
    expect(results.hidden).toBe(false)
    expect(input.getAttribute('aria-expanded')).toBe('true')

    results.querySelector('button').click()

    expect(input.value).toBe('27.7.D')
    expect(results.hidden).toBe(true)
  })

  test('Should auto-populate coordinates when a suggested result is selected', async () => {
    setBodyHtml(baseMarkup())
    mockFetchOnce({
      subrectangles: [
        { subCode: '27.7.D', labelCoordinate: [-5.1234, 50.5678] }
      ]
    })

    await initialiseStatisticalAreaSearch()

    const input = document.querySelector('[data-statistical-area-search]')
    input.value = '27.7'
    input.dispatchEvent(new Event('input'))

    document.querySelector('[data-statistical-area-results] button').click()

    const coordinates = document.querySelector(
      '[data-statistical-area-coordinates]'
    )
    const coordinatesValue = document.querySelector(
      '[data-statistical-area-coordinates-value]'
    )
    expect(coordinates.hidden).toBe(false)
    expect(coordinatesValue.textContent).toBe('50.5678, -5.1234')
  })

  test('Should auto-populate coordinates dynamically as a valid code is typed', async () => {
    setBodyHtml(baseMarkup())
    mockFetchOnce({
      subrectangles: [
        { subCode: '27.7.D', labelCoordinate: [-5.1234, 50.5678] }
      ]
    })

    await initialiseStatisticalAreaSearch()

    const input = document.querySelector('[data-statistical-area-search]')
    const coordinates = document.querySelector(
      '[data-statistical-area-coordinates]'
    )

    input.value = '27.7'
    input.dispatchEvent(new Event('input'))
    expect(coordinates.hidden).toBe(true)

    input.value = '27.7.D'
    input.dispatchEvent(new Event('input'))
    expect(coordinates.hidden).toBe(false)
  })

  test('Should hide coordinates once the typed code no longer matches', async () => {
    setBodyHtml(baseMarkup())
    mockFetchOnce({
      subrectangles: [
        { subCode: '27.7.D', labelCoordinate: [-5.1234, 50.5678] }
      ]
    })

    await initialiseStatisticalAreaSearch()

    const input = document.querySelector('[data-statistical-area-search]')
    const coordinates = document.querySelector(
      '[data-statistical-area-coordinates]'
    )

    input.value = '27.7.D'
    input.dispatchEvent(new Event('input'))
    expect(coordinates.hidden).toBe(false)

    input.value = '27.7.DX'
    input.dispatchEvent(new Event('input'))
    expect(coordinates.hidden).toBe(true)
  })

  test('Should show each result with its ICES rectangle and coordinates', async () => {
    setBodyHtml(baseMarkup())
    mockFetchOnce({
      subrectangles: [
        { subCode: '27D86', labelCoordinate: [-5.1234, 50.5678] },
        { subCode: '27D89' }
      ]
    })

    await initialiseStatisticalAreaSearch()

    const input = document.querySelector('[data-statistical-area-search]')
    input.value = '27D8'
    input.dispatchEvent(new Event('input'))

    const buttons = document.querySelectorAll(
      '[data-statistical-area-results] button'
    )
    expect(
      buttons[0].querySelector('.app-statistical-area-search__option-code')
        .textContent
    ).toBe('27D86')
    expect(
      buttons[0].querySelector('.app-statistical-area-search__option-detail')
        .textContent
    ).toBe('ICES rectangle 27D8 \u00b7 50.5678, -5.1234')
    expect(
      buttons[1].querySelector('.app-statistical-area-search__option-detail')
        .textContent
    ).toBe('ICES rectangle 27D8')
  })

  test('Should show coordinates when a known area radio option is selected', async () => {
    setBodyHtml(baseMarkup())
    mockFetchOnce({
      subrectangles: [{ subCode: '27D86', labelCoordinate: [-5.1234, 50.5678] }]
    })

    await initialiseStatisticalAreaSearch()

    const radioOptions = document.querySelector(
      '[data-statistical-area-options]'
    )
    const coordinates = document.querySelector(
      '[data-statistical-area-coordinates]'
    )
    const coordinatesValue = document.querySelector(
      '[data-statistical-area-coordinates-value]'
    )

    const changeEvent = new Event('change')
    Object.defineProperty(changeEvent, 'target', {
      value: { value: '27D86' }
    })
    radioOptions.dispatchEvent(changeEvent)

    expect(coordinates.hidden).toBe(false)
    expect(coordinatesValue.textContent).toBe('50.5678, -5.1234')
  })

  test('Should hide results when Escape is pressed', async () => {
    setBodyHtml(baseMarkup())
    mockFetchOnce({ subrectangles: [{ subCode: '27.7.D' }] })

    await initialiseStatisticalAreaSearch()

    const input = document.querySelector('[data-statistical-area-search]')
    input.value = '27.7'
    input.dispatchEvent(new Event('input'))
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(
      document.querySelector('[data-statistical-area-results]').hidden
    ).toBe(true)
  })

  test('Should reveal the search panel and focus the input when the "other" radio option is selected', async () => {
    setBodyHtml(baseMarkup())
    mockFetchOnce({ subrectangles: [] })

    await initialiseStatisticalAreaSearch()

    const radioOptions = document.querySelector(
      '[data-statistical-area-options]'
    )
    const input = document.querySelector('[data-statistical-area-search]')
    input.focus = vi.fn()

    const changeEvent = new Event('change')
    Object.defineProperty(changeEvent, 'target', {
      value: { value: 'other' }
    })
    radioOptions.dispatchEvent(changeEvent)

    const panel = document.querySelector('[data-statistical-area-search-panel]')
    expect(panel.hidden).toBe(false)
    expect(input.focus).toHaveBeenCalled()
  })

  test('Should hide the search panel when a non-other radio option is selected', async () => {
    setBodyHtml(baseMarkup())
    mockFetchOnce({ subrectangles: [] })

    await initialiseStatisticalAreaSearch()

    const radioOptions = document.querySelector(
      '[data-statistical-area-options]'
    )
    const changeEvent = new Event('change')
    Object.defineProperty(changeEvent, 'target', {
      value: { value: 'ices' }
    })
    radioOptions.dispatchEvent(changeEvent)

    const panel = document.querySelector('[data-statistical-area-search-panel]')
    expect(panel.hidden).toBe(true)
  })
})
