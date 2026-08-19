import Joi from 'joi'

// Placeholder gear options — a small, temporary fixture pending the Step 03 mock-data layer.
export const gearOptions = [
  { value: 'pots', text: 'Pots' },
  { value: 'nets', text: 'Nets' }
]

export const gearSelectionController = {
  handler(_request, h) {
    return h.view('gear-selection/index', {
      pageTitle: 'Select your gear',
      heading: 'Select your gear',
      backLink: {
        href: '/return-port',
        text: 'Back'
      },
      gearOptions
    })
  }
}

export const gearSelectionSubmitController = {
  options: {
    validate: {
      payload: Joi.object({
        gearType: Joi.string().min(1).required()
      })
    }
  },
  handler(request, h) {
    const { gearType } = request.payload

    return h
      .redirect(
        gearType === 'pots'
          ? '/pots-details'
          : '/not-implemented?return=/gear-selection'
      )
      .code(303)
  }
}
