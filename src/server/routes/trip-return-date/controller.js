import { validateDateInput } from '#/server/common/helpers/journey/date-input.js'
import {
  resolveNextPath,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

const pageTitle = 'Which date did you return from your trip?'
const hintText = 'For example, 31/03/2020'

function viewContext(overrides = {}) {
  return {
    pageTitle,
    heading: pageTitle,
    caption: 'New catch record',
    hintText,
    values: {},
    backLink: {
      href: '/trip-departure-date',
      text: 'Back'
    },
    ...overrides
  }
}

export const tripReturnDateController = {
  handler(_request, h) {
    return h.view('trip-return-date/index', viewContext())
  }
}

export const tripReturnDateSubmitController = {
  handler(request, h) {
    const payload = request.payload || {}
    const result = validateDateInput(
      {
        day: payload['tripReturnDate-day'],
        month: payload['tripReturnDate-month'],
        year: payload['tripReturnDate-year']
      },
      'tripReturnDate',
      'the date you returned from your trip'
    )

    if (!result.isValid) {
      return h
        .view(
          'trip-return-date/index',
          viewContext({
            errorSummary: {
              titleText: 'There is a problem',
              errorList: [
                { text: result.errorMessage, href: '#tripReturnDate-day' }
              ]
            },
            fieldErrors: result.fieldErrors,
            values: result.values
          })
        )
        .code(statusCodes.ok)
    }

    setJourneyState(request, { returnDate: result.isoDate })

    return h.redirect(resolveNextPath(request, '/departure-port')).code(303)
  }
}
