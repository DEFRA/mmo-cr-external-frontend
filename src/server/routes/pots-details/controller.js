export const potsDetailsController = {
  handler(_request, h) {
    return h.view('pots-details/index', {
      pageTitle: 'Pots details',
      heading: 'Pots details',
      backLink: {
        href: '/gear-selection',
        text: 'Back'
      }
    })
  }
}

export const potsDetailsSubmitController = {
  handler(_request, h) {
    return h.redirect('/statistical-area').code(303)
  }
}
