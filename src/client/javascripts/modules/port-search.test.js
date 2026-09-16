// @vitest-environment jsdom
import { initialisePortSearch } from './port-search.js'

function setBodyHtml(html) {
  document.body.innerHTML = html
}

function baseMarkup(portNames) {
  return `
    <input data-port-search />
    <ul data-port-results hidden></ul>
    <script type="application/json" data-port-search-data>${JSON.stringify(portNames)}</script>
  `
}

describe('#initialisePortSearch', () => {
  test('Should do nothing when there is no search input', () => {
    setBodyHtml('<div></div>')

    expect(() => initialisePortSearch()).not.toThrow()
  })

  test('Should default to an empty port list when the data script is missing', () => {
    setBodyHtml('<input data-port-search /><ul data-port-results hidden></ul>')
    initialisePortSearch()

    const input = document.querySelector('[data-port-search]')
    input.value = 'ha'
    input.dispatchEvent(new Event('input'))

    expect(document.querySelector('[data-port-results]').hidden).toBe(true)
  })

  test('Should default to an empty port list when the data script is invalid JSON', () => {
    setBodyHtml(`
      <input data-port-search />
      <ul data-port-results hidden></ul>
      <script type="application/json" data-port-search-data>not-json</script>
    `)
    initialisePortSearch()

    const input = document.querySelector('[data-port-search]')
    input.value = 'ha'
    input.dispatchEvent(new Event('input'))

    expect(document.querySelector('[data-port-results]').hidden).toBe(true)
  })

  test('Should hide results when the query is below the minimum search length', () => {
    setBodyHtml(baseMarkup(['Hastings', 'Harwich']))
    initialisePortSearch()

    const input = document.querySelector('[data-port-search]')
    input.value = 'h'
    input.dispatchEvent(new Event('input'))

    expect(document.querySelector('[data-port-results]').hidden).toBe(true)
    expect(input.getAttribute('aria-expanded')).toBe('false')
  })

  test('Should hide results when there are no matches', () => {
    setBodyHtml(baseMarkup(['Hastings', 'Harwich']))
    initialisePortSearch()

    const input = document.querySelector('[data-port-search]')
    input.value = 'zzz'
    input.dispatchEvent(new Event('input'))

    expect(document.querySelector('[data-port-results]').hidden).toBe(true)
  })

  test('Should render matching options, limited to the maximum result count', () => {
    const portNames = Array.from({ length: 15 }, (_, index) => `Port ${index}`)
    setBodyHtml(baseMarkup(portNames))
    initialisePortSearch()

    const input = document.querySelector('[data-port-search]')
    input.value = 'port'
    input.dispatchEvent(new Event('input'))

    const results = document.querySelector('[data-port-results]')
    expect(results.hidden).toBe(false)
    expect(results.querySelectorAll('button')).toHaveLength(10)
    expect(input.getAttribute('aria-expanded')).toBe('true')
  })

  test('Should select a port when its option is clicked', () => {
    setBodyHtml(baseMarkup(['Hastings', 'Harwich']))
    initialisePortSearch()

    const input = document.querySelector('[data-port-search]')
    input.value = 'ha'
    input.dispatchEvent(new Event('input'))

    const results = document.querySelector('[data-port-results]')
    results.querySelector('button').click()

    expect(input.value).toBe('Hastings')
    expect(results.hidden).toBe(true)
    expect(results.children).toHaveLength(0)
    expect(input.getAttribute('aria-expanded')).toBe('false')
  })

  test('Should hide results when Escape is pressed', () => {
    setBodyHtml(baseMarkup(['Hastings', 'Harwich']))
    initialisePortSearch()

    const input = document.querySelector('[data-port-search]')
    input.value = 'ha'
    input.dispatchEvent(new Event('input'))
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(document.querySelector('[data-port-results]').hidden).toBe(true)
    expect(input.getAttribute('aria-expanded')).toBe('false')
  })

  test('Should ignore other keys on keydown', () => {
    setBodyHtml(baseMarkup(['Hastings', 'Harwich']))
    initialisePortSearch()

    const input = document.querySelector('[data-port-search]')
    input.value = 'ha'
    input.dispatchEvent(new Event('input'))
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))

    expect(document.querySelector('[data-port-results]').hidden).toBe(false)
  })
})
