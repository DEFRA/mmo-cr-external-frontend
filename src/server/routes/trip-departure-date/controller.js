import {
  validateDateInput,
  dateInputValues
} from '#/server/common/helpers/journey/date-input.js'
import {
  catchRecordCaption,
  getJourneyState,
  resolveNextPath,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import { businessDate } from '#/server/common/helpers/journey/catch-record-payload.js'
import {
  earliestDepartureDate,
  earliestDepartureForReturn,
  TRIP_TOO_LONG_MESSAGE
} from '#/server/common/helpers/journey/trip-date-rules.js'

const pageTitle = 'Which date did you set off on your trip?'
const hintText = 'For example, 31/03/2020'
const CHECK_ANSWERS_PATH = '/check-answers'

function viewContext(request, overrides = {}) {
  return {
    pageTitle,
    heading: pageTitle,
    caption: catchRecordCaption(request),
    hintText,
    values: dateInputValues(getJourneyState(request).departureDate),
    backLink: {
      href: '/trip-date',
      text: 'Back'
    },
    ...overrides
  }
}

export const tripDepartureDateController = {
  handler(request, h) {
    return h.view('trip-departure-date/index', viewContext(request))
  }
}

// Changing the departure date from check your answers skips the return-date page, so the trip-level
// rules that page would otherwise apply are checked here against the already-answered return date.
function returnDateBounds(request) {
  const { returnDate } = getJourneyState(request)
  if (request.query?.return !== CHECK_ANSWERS_PATH || !returnDate) {
    return {}
  }

  return {
    notAfterDate: returnDate,
    notAfterMessage:
      'Date you left for your trip must be the same as or before the date you returned',
    notBeforeDate: earliestDepartureForReturn(returnDate),
    notBeforeMessage: TRIP_TOO_LONG_MESSAGE
  }
}

export const tripDepartureDateSubmitController = {
  handler(request, h) {
    const payload = request.payload || {}
    const today = businessDate()
    const result = validateDateInput(
      {
        day: payload['tripDepartureDate-day'],
        month: payload['tripDepartureDate-month'],
        year: payload['tripDepartureDate-year']
      },
      'tripDepartureDate',
      {
        subject: 'the date you left for your trip',
        partSubject: 'Date you left for your trip',
        formatMessage:
          'Enter a date in the correct format, for example 31 3 2019',
        ...earliestDepartureDate(today),
        maxDate: today,
        maxDateMessage:
          'Date you left for your trip must be today or in the past',
        ...returnDateBounds(request)
      }
    )

    if (!result.isValid) {
      return h
        .view(
          'trip-departure-date/index',
          viewContext(request, {
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

    return h
      .redirect(resolveNextPath(request, '/trip-return-date'))
      .code(statusCodes.seeOther)
  }
}
