export const returnPortController = {
  handler(_request, h) {
    return h.view('return-port/index', {
      pageTitle: 'Return port',
      heading: 'Return port',
      backLink: {
        href: '/departure-port',
        text: 'Back'
      }
    })
  }
}

export const returnPortSubmitController = {
  handler(_request, h) {
    return h.redirect('/gear-selection').code(303)
  }
}
