export const draftController = {
  handler(_request, h) {
    return h.view('draft/index', {
      pageTitle: 'Create a draft catch record',
      heading: 'Create a draft catch record',
      backLink: {
        href: '/records',
        text: 'Back'
      }
    })
  }
}
