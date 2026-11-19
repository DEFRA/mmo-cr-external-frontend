import accessibleAutocomplete from 'accessible-autocomplete'

const ariaDescribedByAttribute = 'aria-describedby'

export function initialiseSpeciesSearch() {
  const select = document.querySelector('[data-species-search]')
  if (!select) {
    return
  }

  const id = select.id
  const describedBy = select.getAttribute(ariaDescribedByAttribute)
  const messages = select.dataset
  const interpolate = (template, values) =>
    Object.entries(values).reduce(
      (text, [key, value]) => text.replaceAll(`{{${key}}}`, value),
      template
    )

  accessibleAutocomplete.enhanceSelectElement({
    selectElement: select,
    name: '',
    defaultValue: '',
    placeholder:
      messages.autocompletePlaceholder ?? 'Start typing to display the list',
    minLength: 1,
    showAllValues: false,
    autoselect: false,
    confirmOnBlur: false,
    displayMenu: 'inline',
    tNoResults: () => messages.autocompleteNoResults ?? 'No results found',
    tStatusQueryTooShort: (count) =>
      interpolate(
        messages.autocompleteStatusQueryTooShort ??
          'Type in {{count}} or more characters for results',
        { count }
      ),
    tStatusNoResults: () =>
      messages.autocompleteStatusNoResults ?? 'No search results',
    tStatusSelectedOption: (option, length, index) =>
      interpolate(
        messages.autocompleteStatusSelectedOption ??
          '{{option}} {{index}} of {{length}} is highlighted',
        { option, index: index + 1, length }
      ),
    tStatusResults: (length) =>
      interpolate(
        messages.autocompleteStatusResults ?? '{{count}} results available',
        { count: length }
      ),
    tAssistiveHint: () =>
      messages.autocompleteAssistiveHint ??
      'When autocomplete results are available use up and down arrows to review and enter to select. Touch device users, explore by touch or with swipe gestures.',
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
