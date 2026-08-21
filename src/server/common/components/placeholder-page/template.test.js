import { renderComponent } from '#/test-helpers/component-helpers.js'

describe('Placeholder Page Component', () => {
  describe('With default description', () => {
    let $placeholder

    beforeEach(() => {
      $placeholder = renderComponent('placeholder-page', {
        heading: 'Guidance'
      })
    })

    test('Should render the heading', () => {
      expect(
        $placeholder('[data-testid="app-heading-title"]').text().trim()
      ).toBe('Guidance')
    })

    test('Should render the default placeholder sentence', () => {
      expect(
        $placeholder('[data-testid="app-placeholder-description"]')
          .text()
          .trim()
      ).toBe('The detailed Guidance page will be implemented in a later step.')
    })
  })

  describe('With a custom description', () => {
    let $placeholder

    beforeEach(() => {
      $placeholder = renderComponent('placeholder-page', {
        heading: 'Empty Page',
        description: 'This feature is not included in this walkthrough.'
      })
    })

    test('Should render the custom description instead of the default sentence', () => {
      expect(
        $placeholder('[data-testid="app-placeholder-description"]')
          .text()
          .trim()
      ).toBe('This feature is not included in this walkthrough.')
    })
  })
})
