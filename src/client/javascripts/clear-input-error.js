export function initialiseClearInputErrors() {
  document
    .querySelectorAll('[data-clear-input-error]')
    .forEach((input) => {
      const clearError = () => {
        const group = input.closest('.govuk-form-group')
        if (!group) return

        group.classList.remove('govuk-form-group--error')
        group.querySelectorAll('.govuk-error-message').forEach((message) => {
          message.remove()
        })

        const describedBy = input.getAttribute('aria-describedby')
        if (describedBy) {
          input.setAttribute(
            'aria-describedby',
            describedBy
              .split(' ')
              .filter((id) => !id.endsWith('-error'))
              .join(' ')
          )
        }
      }

      input.addEventListener('focus', clearError)
      input.addEventListener('input', clearError)
    })
}