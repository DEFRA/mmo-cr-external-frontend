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
import {
  latestReturnDate,
  MAX_TRIP_LENGTH_DAYS
} from '#/server/common/helpers/journey/trip-date-rules.js'

const pageTitle = () => t('catchRecord.tripDate.return.title')
const hintText = () => t('common.dateHint')

function viewContext(request, overrides = {}) {
  return {
    pageTitle: pageTitle(),
    heading: pageTitle(),
    caption: catchRecordCaption(request),
    hintText: hintText(),
    values: dateInputValues(getJourneyState(request).returnDate),
    backLink: {
      href: '/trip-departure-date',
      text: t('header.back')
    },
    ...overrides
  }
}

export const tripReturnDateController = {
  handler(request, h) {
    return h.view('trip-return-date/index', viewContext(request))
  }
}

export const tripReturnDateSubmitController = {
  handler(request, h) {
    const payload = request.payload || {}
    const { departureDate } = getJourneyState(request)
    const result = validateDateInput(
      {
        day: payload['tripReturnDate-day'],
        month: payload['tripReturnDate-month'],
        year: payload['tripReturnDate-year']
      },
      'tripReturnDate',
      {
        missingMessages: {
          all: t('tripReturnDate.error.missing.all'),
          day: t('tripReturnDate.error.missing.day'),
          month: t('tripReturnDate.error.missing.month'),
          year: t('tripReturnDate.error.missing.year'),
          dayMonth: t('tripReturnDate.error.missing.dayMonth'),
          dayYear: t('tripReturnDate.error.missing.dayYear'),
          monthYear: t('tripReturnDate.error.missing.monthYear')
        },
        formatMessage: t('tripReturnDate.error.format'),
        maxDate: businessDate(),
        maxDateMessage: t('tripReturnDate.error.max'),
        notBeforeDate: departureDate,
        notBeforeMessage: t('tripReturnDate.error.notBefore'),
        notAfterDate: departureDate && latestReturnDate(departureDate),
        notAfterMessage: t('tripReturnDate.error.tripTooLong', {
          days: MAX_TRIP_LENGTH_DAYS
        })
      }
    )

    if (!result.isValid) {
      return h
        .view(
          'trip-return-date/index',
          viewContext(request, {
            errorSummary: {
              titleText: t('common.errorSummary.title'),
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

    return h
      .redirect(resolveNextPath(request, '/departure-port'))
      .code(statusCodes.seeOther)
  }
}
