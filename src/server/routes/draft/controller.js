import Joi from 'joi'

export const draftController = {
  handler(_request, h) {
    return h.view('draft/index', {
      pageTitle: 'What do you want to do with your draft record?',
      heading: 'What do you want to do with your draft record?',
      caption: 'New catch record',
      backLink: {
        href: '/records',
        text: 'Back'
      }
    })
  }
}

export const draftSubmitController = {
  options: {
    validate: {
      payload: Joi.object({
        draftAction: Joi.string().valid('complete', 'delete').required()
      })
    }
  },
  handler(request, h) {
    const { draftAction } = request.payload

    return h
      .redirect(
        draftAction === 'complete'
          ? '/select-vessel'
          : '/not-implemented?return=/draft'
      )
      .code(303)
  }
}
