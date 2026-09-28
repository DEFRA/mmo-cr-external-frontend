import Joi from 'joi'

import { statusCodes } from '#/server/common/constants/status-codes.js'
import {
  backForCheckAnswers,
  getJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import { isLateSubmission } from '#/server/common/helpers/records/late-submission.js'
import { buildCheckAnswersViewModel } from './view-model.js'

const pageTitle = 'Check your catch record'

// BR-SUB-003: warn (rather than block) when the trip ended more than 24 hours ago.
function lateSubmissionNotification(request) {
  if (!isLateSubmission(getJourneyState(request).returnDate)) {
    return undefined
  }

  return {
    titleText: 'Important',
    text: 'Review the trip end date before continuing.',
    details: {
      reviewLink: '/trip-return-date?return=/check-answers',
      reviewText: 'Review trip end date',
      continueText: 'Continue with submission',
      returnText: 'Return to record to make corrections'
    }
  }
}

function viewContext(request, overrides = {}) {
  const { sections } = buildCheckAnswersViewModel(request)

  return {
    pageTitle,
    heading: pageTitle,
    caption: 'New catch record',
    backLink: {
      href: backForCheckAnswers(request),
      text: 'Back'
    },
    notification: lateSubmissionNotification(request),
    sections,
    ...overrides
  }
}

export const checkAnswersController = {
  handler(request, h) {
    return h.view('check-answers/index', viewContext(request))
  }
}

export const checkAnswersSubmitController = {
  options: {
    validate: {
      payload: Joi.object({
        confirmAccurate: Joi.string().valid('true').required()
      }),
      failAction(request, h) {
        const errorText =
          'Select I confirm the information is complete and accurate'

        return h
          .view(
            'check-answers/index',
            viewContext(request, {
              errorSummary: {
                titleText: 'There is a problem',
                errorList: [{ text: errorText, href: '#confirmAccurate' }]
              },
              fieldErrors: { confirmAccurate: errorText }
            })
          )
          .code(statusCodes.badRequest)
          .takeover()
      }
    }
  },
  handler(_request, h) {
    return h.redirect('/confirmation').code(303)
  }
}
