import Joi from 'joi'

export const catchNotLandedController = {
  handler(_request, h) {
    return h.view('catch-not-landed/index', {
      pageTitle: 'Was any catch not landed?',
      heading: 'Was any catch not landed?',
      backLink: {
        href: '/species-weight',
        text: 'Back'
      }
    })
  }
}

export const catchNotLandedSubmitController = {
  options: {
    validate: {
      payload: Joi.object({
        catchNotLanded: Joi.string().valid('yes', 'no').required()
      })
    }
  },
  handler(request, h) {
    const { catchNotLanded } = request.payload

    return h
      .redirect(
        catchNotLanded === 'no'
          ? '/check-answers'
          : '/not-implemented?return=/catch-not-landed'
      )
      .code(303)
  }
}
