export const accountController = {
  handler(_request, h) {
    return h.view('account/index', {
      pageTitle: 'Your account',
      heading: 'Your account'
    })
  }
}
