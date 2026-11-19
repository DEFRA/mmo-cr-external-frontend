import { t } from '#/server/common/helpers/i18n/translator.js'

import Joi from 'joi'
import Boom from '@hapi/boom'

import { getData } from '#/server/common/data/get-data.js'
import { setAmendmentState } from '#/server/common/helpers/journey/amendment.js'
import { formatDate } from '#/config/nunjucks/filters/format-date.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import { liveCatchRecords } from '#/server/common/helpers/journey/catch-record-service.js'
import {
  reasonContext,
  startAmendment
} from '../edit-catch-record-review/live-amendment.js'

const templatePath = 'edit-catch-record-reason/index'
const EDIT_REASON_MAX_LENGTH = 2000
const defaultPageTitle = () =>
  t('web.edit-catch-record-reason.controller.js.copy.18.1')
const lateRecordPageTitle = () =>
  t('web.edit-catch-record-reason.controller.js.copy.19.1')

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
  const pageTitle = isLateRecord
    ? lateRecordPageTitle()
    : defaultPageTitle()

  return {
    pageTitle,
    heading: pageTitle,
    reference: details.reference,
    notification: isLateRecord
      ? undefined
      : {
          titleText: t('common.important'),
          text: t('editReason.notification', {
            date: formatDate(details.returnDate, 'd MMMM yyyy')
          })
        },
    backLink: {
      href: `/records/${recordId}`,
      text: t('header.back')
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
  async handler(request, h) {
    if (liveCatchRecords()) {
      return h.view(templatePath, await reasonContext(request))
    }
    const { recordId } = request.params
    findRecord(recordId)

    return h.view(templatePath, viewContext(recordId))
  }
}

export const editCatchRecordReasonSubmitController = {
  options: {
    validate: {
      params: Joi.object({
        recordId: Joi.string().required()
      }),
      payload: Joi.object({
        editReason: Joi.string()
          .trim()
          .min(1)
          .max(EDIT_REASON_MAX_LENGTH)
          .required(),
        reasonKey: Joi.string().uuid().optional()
      }),
      async failAction(request, h) {
        if (liveCatchRecords()) {
          const liveErrorText = t('editReason.error.maxLength', {
            max: EDIT_REASON_MAX_LENGTH
          })
          return h
            .view(
              templatePath,
              await reasonContext(request, {
                values: request.payload,
                errorSummary: {
                  titleText: t('common.errorSummary.title'),
                  errorList: [{ text: liveErrorText, href: '#editReason' }]
                },
                fieldErrors: { editReason: liveErrorText }
              })
            )
            .code(statusCodes.badRequest)
            .takeover()
        }
        const { recordId } = request.params
        findRecord(recordId)

        const errorText = t(
          'web.edit-catch-record-reason.controller.js.copy.110.1'
        )

        return h
          .view(
            templatePath,
            viewContext(recordId, {
              errorSummary: {
                titleText: t('common.errorSummary.title'),
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
    if (liveCatchRecords()) {
      return startAmendment(request, h)
    }
    const { recordId } = request.params

    findRecord(recordId)
    // The design never displays the reason back to the user, so only a
    // boolean flag is retained in session — not the free-text reason itself.
    setAmendmentState(request, { recordId, reasonProvided: true })

    return h
      .redirect(`/records/${recordId}/edit-review`)
      .code(statusCodes.seeOther)
  }
}
