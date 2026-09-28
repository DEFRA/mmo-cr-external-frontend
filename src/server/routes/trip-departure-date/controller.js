import {
  formatIsoDate,
  todayIsoDate,
  validateDateInput
} from '#/server/common/helpers/journey/date-input.js'
import {
  getJourneyState,
  resolveNextPath,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

const pageTitle = 'Which date did you set off on your trip?'
const hintText = 'For example, 31/03/2020'
const MAX_DEPARTURE_DATE_AGE_DAYS = 365
const MS_PER_DAY = 24 * 60 * 60 * 1000

// Rolling window (BR-CAT-006): recomputed from today rather than a fixed cutoff date.
function minDepartureIsoDate() {
  const today = new Date(`${todayIsoDate()}T00:00:00.000Z`)
  return new Date(today.getTime() - MAX_DEPARTURE_DATE_AGE_DAYS * MS_PER_DAY)
    .toISOString()
    .slice(0, 10)
}

function viewContext(request, overrides = {}) {
  return {
    pageTitle,
    heading: pageTitle,
    caption: 'New catch record',
    hintText,
    values: getJourneyState(request).tripDepartureDate || {},
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

export const tripDepartureDateSubmitController = {
  handler(request, h) {
    const payload = request.payload || {}
    const minDate = minDepartureIsoDate()
    const result = validateDateInput(
      {
        day: payload['tripDepartureDate-day'],
        month: payload['tripDepartureDate-month'],
        year: payload['tripDepartureDate-year']
      },
      'tripDepartureDate',
      {
        subject: 'the date you left for your trip',
        subjectSuffix: 'you left for your trip',
        formatMessage:
          'Enter a date in the correct format, for example 31 3 2019',
        minDate,
        minDateMessage: `Date you left for your trip must be on or after ${formatIsoDate(minDate)}`,
        maxDateMessage:
          'Date you left for your trip must be today or in the past'
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

    return h.redirect(resolveNextPath(request, '/trip-return-date')).code(303)
  }
}
