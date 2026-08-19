export const privacyNoticeController = {
  handler(_request, h) {
    return h.view('privacy-notice/index', {
      pageTitle: 'Privacy notice',
      heading: 'Privacy notice',
      backLink: {
        href: '/',
        text: 'Back'
      }
    })
  }
}
