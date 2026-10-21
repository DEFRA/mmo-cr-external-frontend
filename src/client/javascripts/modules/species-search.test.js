// @vitest-environment jsdom
import { initialiseSpeciesSearch } from './species-search.js'

function renderSelect(error = false) {
  document.body.innerHTML = `
    <label for="species">Add species</label>
    <select id="species" name="species" data-species-search${error ? ' aria-describedby="species-error"' : ''}>
      <option value="">Start typing to display the list</option>
      <option value="Herring (HER)">Herring (HER)</option>
      <option value="Queen scallop (QSC)">Queen scallop (QSC)</option>
    </select>
    ${error ? '<p id="species-error">Select a species to add</p>' : ''}
  `
}

describe('#initialiseSpeciesSearch', () => {
  test('Should do nothing on pages without a species search', () => {
    document.body.innerHTML = ''

    expect(() => initialiseSpeciesSearch()).not.toThrow()
  })

  test('Should enhance the select with an inline accessible autocomplete', () => {
    renderSelect()

    initialiseSpeciesSearch()

    const input = document.querySelector('input#species')
    expect(input.getAttribute('placeholder')).toBe(
      'Start typing to display the list'
    )
    expect(input.getAttribute('aria-autocomplete')).toBe('list')
    expect(document.querySelector('.autocomplete__menu--inline')).not.toBeNull()
    expect(document.querySelector('select[name="species"]').style.display).toBe(
      'none'
    )
    expect(document.querySelector('datalist')).toBeNull()
  })

  test('Should preserve the inline error association on the generated input', () => {
    renderSelect(true)

    initialiseSpeciesSearch()

    const input = document.querySelector('input#species')
    expect(input.classList.contains('govuk-input--error')).toBe(true)
    expect(input.getAttribute('aria-describedby')).toContain('species-error')
  })

  test('Should clear the previously confirmed species when the user edits the query', () => {
    renderSelect()
    initialiseSpeciesSearch()
    const select = document.querySelector('select[name="species"]')
    select.value = 'Herring (HER)'
    const input = document.querySelector('input#species')

    input.value = 'Queen'
    input.dispatchEvent(new Event('input', { bubbles: true }))

    expect(select.value).toBe('')
  })

  test('Should filter suggestions and submit the confirmed option through the original select', async () => {
    renderSelect()
    initialiseSpeciesSearch()
    const input = document.querySelector('input#species')
    input.focus()
    input.value = 'Herring'
    input.dispatchEvent(new Event('input', { bubbles: true }))

    await vi.waitFor(() => {
      expect(document.querySelector('.autocomplete__option')?.textContent).toBe(
        'Herring (HER)'
      )
    })
    document.querySelector('.autocomplete__option').click()

    await vi.waitFor(() => {
      expect(document.querySelector('select[name="species"]').value).toBe(
        'Herring (HER)'
      )
    })
  })

  test('Should render species names as text rather than HTML', async () => {
    renderSelect()
    const option = document.createElement('option')
    option.value = 'Fish <img src=x onerror="alert(1)"> (FIS)'
    option.textContent = option.value
    document.querySelector('select').append(option)
    initialiseSpeciesSearch()
    const input = document.querySelector('input#species')
    input.focus()
    input.value = 'Fish'
    input.dispatchEvent(new Event('input', { bubbles: true }))

    await vi.waitFor(() => {
      expect(document.querySelector('.autocomplete__option')?.textContent).toBe(
        option.value
      )
    })
    expect(document.querySelector('.autocomplete__menu img')).toBeNull()
  })
})
