import Joi from 'joi'

import { getData } from '#/server/common/data/get-data.js'
import { findAmendableRecord } from '#/server/common/helpers/records/find-amendable-record.js'
import { recordAmendment } from '#/server/common/helpers/records/amendment-audit-log.js'
import {
  getAmendmentState,
  clearAmendmentState
} from '#/server/common/helpers/journey/amendment.js'
import { buildCheckAnswersViewModel } from '#/server/routes/check-answers/view-model.js'
import { formatDate } from '#/config/nunjucks/filters/format-date.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

const AMENDMENT_CHANGE_HREF = '/not-implemented?return=/records'

function viewContext(request, recordId, overrides = {}) {
  const record = findAmendableRecord(recordId)
  const details = record.details || getData('catchRecordDetails')
  const { sections } = buildCheckAnswersViewModel(request, {
    buildChangeHref: () => AMENDMENT_CHANGE_HREF,
    hideVesselChange: true
  })
  const heading =
    record.recordId === 'late-1'
      ? `Edit the record for ${details.vesselName}`
      : `Catch record for ${details.vesselName}`

  return {
    pageTitle: heading,
    heading,
    reference: details.reference,
    notification: {
      titleText: 'Important',
      html:
        '<p class="govuk-body govuk-!-font-weight-bold govuk-!-margin-bottom-1">Catch record submitted:</p>' +
        `<p class="govuk-body">${formatDate(details.submittedDate, 'd MMMM yyyy')} ${details.submittedTime}</p>` +
        '<p class="govuk-body govuk-!-font-weight-bold govuk-!-margin-bottom-1">Submitted by:</p>' +
        `<p class="govuk-body">${details.submittedBy}</p>`
    },
    backLink: {
      href: `/records/${recordId}`,
      text: 'Back'
    },
    sections,
    ...overrides
  }
}

// True only when the amendment reason for this exact record is still held in session.
function hasValidAmendment(request, recordId) {
  const amendment = getAmendmentState(request)
  return amendment.recordId === recordId && amendment.reasonProvided === true
}

export const editCatchRecordReviewController = {
  options: {
    validate: {
      params: Joi.object({
        recordId: Joi.string().required()
      })
    }
  },
  handler(request, h) {
    const { recordId } = request.params
    findAmendableRecord(recordId)

    if (!hasValidAmendment(request, recordId)) {
      return h.redirect(`/records/${recordId}/edit-reason`).code(302)
    }

    return h.view(
      'edit-catch-record-review/index',
      viewContext(request, recordId)
    )
  }
}

export const editCatchRecordReviewSubmitController = {
  options: {
    validate: {
      params: Joi.object({
        recordId: Joi.string().required()
      }),
      payload: Joi.object({
        confirmAccurate: Joi.string().valid('true').required()
      }),
      failAction(request, h) {
        const { recordId } = request.params
        findAmendableRecord(recordId)

        if (!hasValidAmendment(request, recordId)) {
          return h
            .redirect(`/records/${recordId}/edit-reason`)
            .code(302)
            .takeover()
        }

        const errorText =
          'Select I confirm the information is complete and accurate'

        return h
          .view(
            'edit-catch-record-review/index',
            viewContext(request, recordId, {
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
  handler(request, h) {
    const { recordId } = request.params
    findAmendableRecord(recordId)

    if (!hasValidAmendment(request, recordId)) {
      return h.redirect(`/records/${recordId}/edit-reason`).code(302)
    }

    const { reason } = getAmendmentState(request)
    recordAmendment({
      recordId,
      reason,
      amendedBy: getData('account').name,
      amendedAt: new Date().toISOString()
    })
    clearAmendmentState(request)

    return h.redirect('/confirmation').code(303)
  }
}
