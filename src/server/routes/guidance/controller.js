/**
 * The Catch Recording entry page.
 */
export const guidanceController = {
  handler(_request, h) {
    return h.view('guidance/index', {
      pageTitle: 'How to record your catch',
      heading: 'How to record your catch',
      showStartButton: true
    })
  }
}
