export const confirmationController = {
  handler(_request, h) {
    return h.view('confirmation/index', {
      pageTitle: 'Catch record submitted',
      heading: 'Catch record submitted'
    })
  }
}
