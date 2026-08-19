export const tripReturnDateController = {
  handler(_request, h) {
    return h.view('trip-return-date/index', {
      pageTitle: 'When did you return?',
      heading: 'When did you return?',
      backLink: {
        href: '/trip-departure-date',
        text: 'Back'
      }
    })
  }
}

export const tripReturnDateSubmitController = {
  handler(_request, h) {
    return h.redirect('/departure-port').code(303)
  }
}
