export const checkAnswersController = {
  handler(_request, h) {
    return h.view('check-answers/index', {
      pageTitle: 'Check your answers',
      heading: 'Check your answers',
      backLink: {
        href: '/catch-not-landed',
        text: 'Back'
      }
    })
  }
}

export const checkAnswersSubmitController = {
  handler(_request, h) {
    return h.redirect('/confirmation').code(303)
  }
}
