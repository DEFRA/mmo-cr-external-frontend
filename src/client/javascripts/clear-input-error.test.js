// @vitest-environment jsdom
import { initialiseClearInputErrors } from './clear-input-error.js'

function setBodyHtml(html) {
  document.body.innerHTML = html
}

describe('#initialiseClearInputErrors', () => {
  test('Should do nothing when there are no matching inputs', () => {
    setBodyHtml('<div></div>')

    expect(() => initialiseClearInputErrors()).not.toThrow()
  })

  test('Should do nothing when the input has no form group ancestor', () => {
    setBodyHtml('<input data-clear-input-error />')
    initialiseClearInputErrors()

    const input = document.querySelector('[data-clear-input-error]')

    expect(() => input.dispatchEvent(new Event('focus'))).not.toThrow()
  })

  test('Should clear the error state and error messages on focus', () => {
    setBodyHtml(`
      <div class="govuk-form-group govuk-form-group--error">
        <p class="govuk-error-message">Error message</p>
        <input data-clear-input-error aria-describedby="hint port-error" />
      </div>
    `)
    initialiseClearInputErrors()

    const group = document.querySelector('.govuk-form-group')
    const input = document.querySelector('[data-clear-input-error]')
    input.dispatchEvent(new Event('focus'))

    expect(group.classList.contains('govuk-form-group--error')).toBe(false)
    expect(document.querySelector('.govuk-error-message')).toBeNull()
    expect(input.getAttribute('aria-describedby')).toBe('hint')
  })

  test('Should clear the error state on input when there is no aria-describedby', () => {
    setBodyHtml(`
      <div class="govuk-form-group govuk-form-group--error">
        <input data-clear-input-error />
      </div>
    `)
    initialiseClearInputErrors()

    const group = document.querySelector('.govuk-form-group')
    const input = document.querySelector('[data-clear-input-error]')
    input.dispatchEvent(new Event('input'))

    expect(group.classList.contains('govuk-form-group--error')).toBe(false)
    expect(input.getAttribute('aria-describedby')).toBeNull()
  })
})
