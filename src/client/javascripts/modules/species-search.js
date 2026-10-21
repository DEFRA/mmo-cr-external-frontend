import accessibleAutocomplete from 'accessible-autocomplete'

const ariaDescribedByAttribute = 'aria-describedby'

export function initialiseSpeciesSearch() {
  const select = document.querySelector('[data-species-search]')
  if (!select) {
    return
  }

  const id = select.id
  const describedBy = select.getAttribute(ariaDescribedByAttribute)
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
      ariaDescribedByAttribute,
      [input.getAttribute(ariaDescribedByAttribute), describedBy]
        .filter(Boolean)
        .join(' ')
    )
  }
}
