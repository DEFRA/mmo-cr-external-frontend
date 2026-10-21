import { buildNavigation } from '#/config/nunjucks/context/build-navigation.js'

/**
 * The Catch Recording entry page.
 */
export const guidanceController = {
  handler(request, h) {
    return h.view('guidance/index', {
      pageTitle: 'How to record your catch',
      heading: 'How to record your catch',
      navigation: buildNavigation(request, { showWhenSignedOut: true }),
      backLink: {
        href: '/records',
        text: 'Back'
      },
      showStartButton: true
    })
  }
}
