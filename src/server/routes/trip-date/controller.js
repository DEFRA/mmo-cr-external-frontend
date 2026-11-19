import Joi from 'joi'

import {
  catchRecordCaption,
  getJourneyState,
  resolveNextPath,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import { t } from '#/server/common/helpers/i18n/translator.js'

function viewContext(request, overrides = {}) {
  const pageTitle = t('tripDate.title')

  return {
    pageTitle,
    heading: pageTitle,
    caption: catchRecordCaption(request),
    tripSameDate: getJourneyState(request).tripSameDate,
    backLink: {
      href: '/select-vessel',
      text: t('header.back')
    },
    ...overrides
  }
}

export const tripDateController = {
  handler(request, h) {
    return h.view('trip-date/index', viewContext(request))
  }
}

export const tripDateSubmitController = {
  options: {
    validate: {
      payload: Joi.object({
        tripSameDate: Joi.string().valid('yes', 'no').required()
      }),
      failAction(request, h) {
        const errorText = t('tripDate.error')

        return h
          .view(
            'trip-date/index',
            viewContext(request, {
              errorSummary: {
                titleText: t('common.errorSummary.title'),
                errorList: [{ text: errorText, href: '#tripSameDate' }]
              },
              fieldErrors: { tripSameDate: errorText }
            })
          )
          .code(statusCodes.ok)
          .takeover()
      }
    }
  },
  handler(request, h) {
    const { tripSameDate } = request.payload

    setJourneyState(request, { tripSameDate: tripSameDate === 'yes' })

    return h
      .redirect(
        resolveNextPath(
          request,
          tripSameDate === 'yes' ? '/departure-port' : '/trip-departure-date'
        )
      )
      .code(statusCodes.seeOther)
  }
}
