import { t } from '#/server/common/helpers/i18n/translator.js'

import Joi from 'joi'
import Boom from '@hapi/boom'
import { randomUUID } from 'node:crypto'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import {
  catchRecordService,
  liveCatchRecords
} from '#/server/common/helpers/journey/catch-record-service.js'
import { getJourneyState } from '#/server/common/helpers/journey/navigation.js'
import { recordJourney } from '#/server/common/helpers/journey/catch-record-mapping.js'

const errorText = () => t('catchRecord.draftAction.validation.none')
const MAX_RECORD_ID_LENGTH = 200
const query = Joi.object({
  recordId: Joi.string().trim().min(1).max(MAX_RECORD_ID_LENGTH).optional()
})

function selectedDraft(request) {
  const action = request.yar.get('draftAction')
  if (
    !action ||
    request.query.recordId !== action.id ||
    request.payload?.actionKey !== action.key
  ) {
    throw Boom.badRequest(t('catchRecord.error.openDraftBeforeAction'), {
      catchRecordError: true
    })
  }
  return action
}

function viewContext(overrides = {}) {
  return {
    pageTitle: t('catchRecord.draftAction.heading'),
    heading: t('catchRecord.draftAction.heading'),
    caption: overrides.reference || t('common.newCatchRecord'),
    backLink: {
      href: '/records',
      text: t('header.back')
    },
    ...overrides
  }
}

export const draftController = {
  options: { validate: { query } },
  async handler(request, h) {
    const recordId =
      request.query.recordId || getJourneyState(request).catchRecordId
    if (!recordId) {
      return h.redirect('/records').code(statusCodes.seeOther)
    }
    if (!request.query.recordId) {
      return h
        .redirect(`/draft?recordId=${encodeURIComponent(recordId)}`)
        .code(statusCodes.seeOther)
    }
    const { client, correlationId } = catchRecordService()
    const record = await client.getRecord({
      catchRecordId: recordId,
      correlationId
    })
    if (record.status !== 'DRAFT') {
      throw Boom.conflict(
        t('catchRecord.error.noLongerDraft'),
        { catchRecordError: true }
      )
    }
    const action = {
      id: record.id,
      reference: record.catchRecordReference,
      version: record.version,
      key: randomUUID(),
      numberOfSubmissions: record.numberOfSubmissions
    }
    request.yar.set('draftAction', action)
    return h.view(
      'draft/index',
      viewContext({ actionKey: action.key, reference: action.reference })
    )
  }
}

export const draftSubmitController = {
  options: {
    validate: {
      query,
      payload: Joi.object({
        draftAction: Joi.string().valid('complete', 'delete').required(),
        actionKey: Joi.string().uuid().required()
      }),
      failAction(request, h) {
        const action = selectedDraft(request)
        return h
          .view(
            'draft/index',
            viewContext({
              actionKey: action.key,
              reference: action.reference,
              errorSummary: {
                titleText: t('common.errorSummary.title'),
                errorList: [{ text: errorText(), href: '#draftAction' }]
              },
              fieldErrors: { draftAction: errorText() }
            })
          )
          .code(statusCodes.badRequest)
          .takeover()
      }
    }
  },
  async handler(request, h) {
    const { draftAction } = request.payload
    const action = selectedDraft(request)
    const { client, correlationId } = catchRecordService()
    if (draftAction === 'delete') {
      if (action.numberOfSubmissions !== 0) {
        throw Boom.conflict(
          t('catchRecord.error.draftHasSubmissions'),
          { catchRecordError: true }
        )
      }
      await client.deleteRecord({
        catchRecordId: action.id,
        version: action.version,
        correlationId
      })
      if (getJourneyState(request).catchRecordId === action.id) {
        request.yar.set('journey', {})
      }
      request.yar.clear('draftAction')
      return h.redirect('/records').code(statusCodes.seeOther)
    }
    if (!liveCatchRecords()) {
      throw Boom.conflict(
        t('catchRecord.error.liveSavingRequired'),
        { catchRecordError: true }
      )
    }
    const record = await client.getRecord({
      catchRecordId: action.id,
      correlationId
    })
    if (record.status !== 'DRAFT' || record.version !== action.version) {
      throw Boom.conflict(
        t('catchRecord.error.draftChanged'),
        { catchRecordError: true }
      )
    }
    request.yar.set('journey', recordJourney(record))
    request.yar.clear('draftAction')
    return h.redirect('/trip-date').code(statusCodes.seeOther)
  }
}
