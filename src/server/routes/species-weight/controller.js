export const speciesWeightController = {
  handler(_request, h) {
    return h.view('species-weight/index', {
      pageTitle: 'Species weight',
      heading: 'Species weight',
      backLink: {
        href: '/species-selection',
        text: 'Back'
      }
    })
  }
}

export const speciesWeightSubmitController = {
  handler(_request, h) {
    return h.redirect('/catch-not-landed').code(303)
  }
}
