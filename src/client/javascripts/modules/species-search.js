import accessibleAutocomplete from 'accessible-autocomplete'

export function initialiseSpeciesSearch() {
  const select = document.querySelector('[data-species-search]')
  if (!select) {
    return
  }

  const id = select.id
  const describedBy = select.getAttribute('aria-describedby')
  accessibleAutocomplete.enhanceSelectElement({
    selectElement: select,
    name: '',
    defaultValue: '',
    placeholder: 'Start typing to display the list',
    minLength: 0,
    showAllValues: true,
    autoselect: false,
    confirmOnBlur: false,
    displayMenu: 'inline',
    inputClasses: `govuk-input${describedBy ? ' govuk-input--error' : ''}`,
    templates: {
      suggestion(value) {
        const label = document.createElement('span')
        label.textContent = value
        return label.innerHTML
      }
    }
  })

  const input = document.getElementById(id)
  input.addEventListener('input', () => {
    select.value = ''
  })

  if (describedBy) {
    input.setAttribute(
      'aria-describedby',
      [input.getAttribute('aria-describedby'), describedBy]
        .filter(Boolean)
        .join(' ')
    )
  }
}
