import { renderComponent } from '#/test-helpers/component-helpers.js'

describe('Page Navigation Component', () => {
  let $pageNavigation

  describe('With a Back link', () => {
    beforeEach(() => {
      $pageNavigation = renderComponent('page-navigation', {
        backLink: { href: '/', text: 'Back' },
        language: { current: 'en', href: '/about?lang=cy' }
      })
    })

    test('Should render the page navigation component', () => {
      expect(
        $pageNavigation('[data-testid="app-page-navigation"]')
      ).toHaveLength(1)
    })

    test('Should render the Back link with the supplied href', () => {
      const $backLink = $pageNavigation(
        '[data-testid="app-page-navigation-back-link"]'
      )
      expect($backLink).toHaveLength(1)
      expect($backLink.attr('href')).toBe('/')
      expect($backLink.text().trim()).toBe('Back')
    })
  })

  describe('With a supplied Back link text', () => {
    beforeEach(() => {
      $pageNavigation = renderComponent('page-navigation', {
        backLink: { href: '/start', text: 'Back to start' },
        language: { current: 'en', href: '/start?lang=cy' }
      })
    })

    test('Should render the supplied text', () => {
      expect(
        $pageNavigation('[data-testid="app-page-navigation-back-link"]')
          .text()
          .trim()
      ).toBe('Back to start')
    })
  })

  describe('Without a Back link', () => {
    beforeEach(() => {
      $pageNavigation = renderComponent('page-navigation', {
        language: { current: 'en', href: '/?lang=cy' }
      })
    })

    test('Should not render a Back link', () => {
      expect(
        $pageNavigation('[data-testid="app-page-navigation-back-link"]')
      ).toHaveLength(0)
    })

    test('Should not render an empty structural placeholder for the Back link', () => {
      expect($pageNavigation('.govuk-back-link')).toHaveLength(0)
    })
  })

  describe('Language selector', () => {
    beforeEach(() => {
      $pageNavigation = renderComponent('page-navigation', {
        language: { current: 'en', href: '/about?lang=cy' }
      })
    })

    test('Should render the current language as text, not a link', () => {
      const $current = $pageNavigation(
        '[data-testid="app-page-navigation-language-current"]'
      )
      expect($current).toHaveLength(1)
      expect($current.is('a')).toBe(false)
      expect($current.attr('lang')).toBe('en')
      expect($current.text().trim()).toBe('English')
    })

    test('Should render the Cymraeg link with lang/hreflang and the given href', () => {
      const $cymraeg = $pageNavigation(
        '[data-testid="app-page-navigation-language-link"]'
      )
      expect($cymraeg).toHaveLength(1)
      expect($cymraeg.attr('lang')).toBe('cy')
      expect($cymraeg.attr('hreflang')).toBe('cy')
      expect($cymraeg.attr('href')).toBe('/about?lang=cy')
      expect($cymraeg.text().trim()).toBe('Cymraeg')
    })

    test('Should expose the language switcher as a labelled landmark', () => {
      const $nav = $pageNavigation(
        '[data-testid="app-page-navigation-language"]'
      )
      expect($nav.is('nav')).toBe(true)
      expect($nav.attr('aria-label')).toBe('Language switcher')
    })
  })
})
