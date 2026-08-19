export const tripDepartureDateController = {
  handler(_request, h) {
    return h.view('trip-departure-date/index', {
      pageTitle: 'When did you leave?',
      heading: 'When did you leave?',
      backLink: {
        href: '/trip-date',
        text: 'Back'
      }
    })
  }
}

export const tripDepartureDateSubmitController = {
  handler(_request, h) {
    return h.redirect('/trip-return-date').code(303)
  }
}
