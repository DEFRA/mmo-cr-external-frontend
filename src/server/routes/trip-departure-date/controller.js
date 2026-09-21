import { validateDateInput } from '#/server/common/helpers/journey/date-input.js'
import {
  resolveNextPath,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

const pageTitle = 'Which date did you set off on your trip?'
const hintText = 'For example, 31/03/2020'

function viewContext(overrides = {}) {
  return {
    pageTitle,
    heading: pageTitle,
    caption: 'New catch record',
    hintText,
    values: {},
    backLink: {
      href: '/trip-date',
      text: 'Back'
    },
    ...overrides
  }
}

export const tripDepartureDateController = {
  handler(_request, h) {
    return h.view('trip-departure-date/index', viewContext())
  }
}

export const tripDepartureDateSubmitController = {
  handler(request, h) {
    const payload = request.payload || {}
    const result = validateDateInput(
      {
        day: payload['tripDepartureDate-day'],
        month: payload['tripDepartureDate-month'],
        year: payload['tripDepartureDate-year']
      },
      'tripDepartureDate',
      'the date you left for your trip'
    )

    if (!result.isValid) {
      return h
        .view(
          'trip-departure-date/index',
          viewContext({
            errorSummary: {
              titleText: 'There is a problem',
              errorList: [
                { text: result.errorMessage, href: '#tripDepartureDate-day' }
              ]
            },
            fieldErrors: result.fieldErrors,
            values: result.values
          })
        )
        .code(statusCodes.ok)
    }

    setJourneyState(request, { departureDate: result.isoDate })

    return h.redirect(resolveNextPath(request, '/trip-return-date')).code(303)
  }
}
