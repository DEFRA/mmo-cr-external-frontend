export const statisticalAreaOtherController = {
  handler(_request, h) {
    return h.view('statistical-area-other/index', {
      pageTitle: 'Alternative statistical area',
      heading: 'Alternative statistical area',
      backLink: {
        href: '/statistical-area',
        text: 'Back'
      }
    })
  }
}

export const statisticalAreaOtherSubmitController = {
  handler(_request, h) {
    return h.redirect('/species-selection').code(303)
  }
}
