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

const errorText = 'Select what you want to do with this draft record'
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
    throw Boom.badRequest('Open the draft record before choosing an action', {
      catchRecordError: true
    })
  }
  return action
}

function viewContext(overrides = {}) {
  return {
    pageTitle: 'What do you want to do with your draft record?',
    heading: 'What do you want to do with your draft record?',
    caption: overrides.reference || 'New catch record',
    backLink: {
      href: '/records',
      text: 'Back'
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
        'This record is no longer a draft. Return to Your catch records.',
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
                titleText: 'There is a problem',
                errorList: [{ text: errorText, href: '#draftAction' }]
              },
              fieldErrors: { draftAction: errorText }
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
          'A draft with previous submissions cannot be deleted.',
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
        'Live journey saving must be enabled before completing a saved draft.',
        { catchRecordError: true }
      )
    }
    const record = await client.getRecord({
      catchRecordId: action.id,
      correlationId
    })
    if (record.status !== 'DRAFT' || record.version !== action.version) {
      throw Boom.conflict(
        'This draft has changed. Reopen it from Your catch records.',
        { catchRecordError: true }
      )
    }
    request.yar.set('journey', recordJourney(record))
    request.yar.clear('draftAction')
    return h.redirect('/trip-date').code(statusCodes.seeOther)
  }
}
