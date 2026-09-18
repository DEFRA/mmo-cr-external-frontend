import Joi from 'joi'
import Boom from '@hapi/boom'

import { getData } from '#/server/common/data/get-data.js'
import { setAmendmentState } from '#/server/common/helpers/journey/amendment.js'
import { formatDate } from '#/config/nunjucks/filters/format-date.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

const defaultPageTitle = 'Why are you editing this catch record?'
const lateRecordPageTitle = 'Why are you editing this record?'

function findRecord(recordId) {
  const record = getData('allRecords').find(
    (item) => item.recordId === recordId
  )

  if (!record) {
    throw Boom.notFound()
  }

  return record
}

function viewContext(recordId, overrides = {}) {
  const record = findRecord(recordId)
  const details = record.details || getData('catchRecordDetails')
  const isLateRecord = record.recordId === 'late-1'
  const pageTitle = isLateRecord ? lateRecordPageTitle : defaultPageTitle

  return {
    pageTitle,
    heading: pageTitle,
    reference: details.reference,
    notification: isLateRecord
      ? undefined
      : {
          titleText: 'Important',
          text: `This catch record was submitted for a trip that ended on ${formatDate(details.returnDate, 'd MMMM yyyy')}.`
        },
    backLink: {
      href: `/records/${recordId}`,
      text: 'Back'
    },
    ...overrides
  }
}

export const editCatchRecordReasonController = {
  options: {
    validate: {
      params: Joi.object({
        recordId: Joi.string().required()
      })
    }
  },
  handler(request, h) {
    const { recordId } = request.params
    findRecord(recordId)

    return h.view('edit-catch-record-reason/index', viewContext(recordId))
  }
}

export const editCatchRecordReasonSubmitController = {
  options: {
    validate: {
      params: Joi.object({
        recordId: Joi.string().required()
      }),
      payload: Joi.object({
        editReason: Joi.string().trim().min(1).max(2000).required()
      }),
      failAction(request, h) {
        const { recordId } = request.params
        findRecord(recordId)

        const errorText = 'Enter the reason for editing this catch record'

        return h
          .view(
            'edit-catch-record-reason/index',
            viewContext(recordId, {
              errorSummary: {
                titleText: 'There is a problem',
                errorList: [{ text: errorText, href: '#editReason' }]
              },
              fieldErrors: { editReason: errorText },
              values: request.payload
            })
          )
          .code(statusCodes.badRequest)
          .takeover()
      }
    }
  },
  handler(request, h) {
    const { recordId } = request.params

    findRecord(recordId)
    // The design never displays the reason back to the user, so only a
    // boolean flag is retained in session — not the free-text reason itself.
    setAmendmentState(request, { recordId, reasonProvided: true })

    return h.redirect(`/records/${recordId}/edit-review`).code(303)
  }
}
