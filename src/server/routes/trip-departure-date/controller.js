import { t } from '#/server/common/helpers/i18n/translator.js'

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
import { formatDate } from '#/config/nunjucks/filters/format-date.js'
import {
  earliestDepartureDate,
  earliestDepartureForReturn,
  MAX_TRIP_LENGTH_DAYS,
  MAX_TRIP_START_AGE_DAYS,
  MIN_DEPARTURE_DATE
} from '#/server/common/helpers/journey/trip-date-rules.js'

const pageTitle = () => t('catchRecord.tripDate.departure.title')
const hintText = () => t('common.dateHint')
const CHECK_ANSWERS_PATH = '/check-answers'

function viewContext(request, overrides = {}) {
  return {
    pageTitle: pageTitle(),
    heading: pageTitle(),
    caption: catchRecordCaption(request),
    hintText: hintText(),
    values: dateInputValues(getJourneyState(request).departureDate),
    backLink: {
      href: '/trip-date',
      text: t('header.back')
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
    notAfterMessage: t('tripDepartureDate.error.notAfter'),
    notBeforeDate: earliestDepartureForReturn(returnDate),
    notBeforeMessage: t('tripDepartureDate.error.tripTooLong', {
      days: MAX_TRIP_LENGTH_DAYS
    })
  }
}

export const tripDepartureDateSubmitController = {
  handler(request, h) {
    const payload = request.payload || {}
    const today = businessDate()
    const departureDateLimits = earliestDepartureDate(today)
    const result = validateDateInput(
      {
        day: payload['tripDepartureDate-day'],
        month: payload['tripDepartureDate-month'],
        year: payload['tripDepartureDate-year']
      },
      'tripDepartureDate',
      {
        missingMessages: {
          all: t('tripDepartureDate.error.missing.all'),
          day: t('tripDepartureDate.error.missing.day'),
          month: t('tripDepartureDate.error.missing.month'),
          year: t('tripDepartureDate.error.missing.year'),
          dayMonth: t('tripDepartureDate.error.missing.dayMonth'),
          dayYear: t('tripDepartureDate.error.missing.dayYear'),
          monthYear: t('tripDepartureDate.error.missing.monthYear')
        },
        formatMessage: t('tripDepartureDate.error.format'),
        ...departureDateLimits,
        minDateMessage:
          departureDateLimits.minDate === MIN_DEPARTURE_DATE
            ? t('tripDepartureDate.error.minLaunch', {
                date: formatDate(MIN_DEPARTURE_DATE, 'd MMMM yyyy')
              })
            : t('tripDepartureDate.error.minAge', {
                days: MAX_TRIP_START_AGE_DAYS
              }),
        maxDate: today,
        maxDateMessage: t('tripDepartureDate.error.max'),
        ...returnDateBounds(request)
      }
    )

    if (!result.isValid) {
      return h
        .view(
          'trip-departure-date/index',
          viewContext(request, {
            errorSummary: {
              titleText: t('common.errorSummary.title'),
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
