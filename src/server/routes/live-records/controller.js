import { randomUUID } from 'node:crypto'
import Boom from '@hapi/boom'
import { config } from '#/config/config.js'
import { replacementPayload } from '#/server/common/helpers/journey/catch-record-payload.js'
import { MapStatisticalAreasReferenceDataError } from '#/server/common/clients/map-statistical-areas-reference-data.js'
import {
  catchRecordService,
  liveCatchRecords
} from '#/server/common/helpers/journey/catch-record-service.js'
import {
  getJourneyState,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import { recordJourney } from '#/server/common/helpers/journey/catch-record-mapping.js'
import { buildPagination } from '#/server/common/helpers/records/pagination.js'
import {
  getStatusDisplay,
  getRecordDisplayStatus
} from '#/server/common/helpers/records/status-display.js'
import { submittedSummary } from './submitted-summary.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

const RECORD_LIST_LIMIT = 100

export async function listLiveRecords(request, h) {
  const { client, correlationId } = catchRecordService()
  const result = await client.listRecords({
    limit: RECORD_LIST_LIMIT,
    status: request.query.status,
    correlationId
  })
  const pagination = buildPagination({
    items: result.items,
    page: request.query.page || 1,
    pageSize: 10
  })
  const records = await Promise.all(
    pagination.pageItems.map(async (summary) => {
      const record =
        summary.status === 'SUBMITTED' && summary.displayStatus !== 'Late'
          ? await client.getRecord({ catchRecordId: summary.id, correlationId })
          : summary
      const displayStatus = getRecordDisplayStatus(record)
      return {
        ...record,
        displayStatus,
        statusTagClasses: getStatusDisplay(displayStatus.toLowerCase())
          .tagClasses
      }
    })
  )
  return h.view('live-records/list', {
    pageTitle: 'Your catch records',
    heading: 'Your catch records',
    bodyClasses: 'app-records-page',
    backLink: { href: '/', text: 'Back' },
    recordDetailsEnabled: liveCatchRecords(),
    records,
    pagination,
    paginationItems: Array.from(
      { length: pagination.pageCount },
      (_, index) => ({
        number: index + 1,
        href: `?page=${index + 1}&status=${request.query.status || ''}`,
        current: index + 1 === pagination.currentPage
      })
    ),
    bounded: result.count === RECORD_LIST_LIMIT,
    statusFilter: request.query.status || ''
  })
}

export async function showLiveRecord(request, h) {
  const { client, correlationId } = catchRecordService()
  const record = await client.getRecord({
    catchRecordId: request.params.recordId,
    correlationId
  })
  const submissions = await client.listSubmissions({
    catchRecordId: record.id,
    correlationId
  })
  request.yar.set('recordAction', {
    id: record.id,
    version: record.version,
    key: randomUUID()
  })
  const submitted = record.status === 'SUBMITTED'
  return h.view(submitted ? 'live-records/submitted' : 'live-records/details', {
    pageTitle: `Catch record for ${record.vessel.nameSnapshot}`,
    record: { ...record, displayStatus: getRecordDisplayStatus(record) },
    sections: submitted ? submittedSummary(record) : undefined,
    latestPdf: submissions.submissions
      .filter((submission) =>
        submission.artifacts.some((artifact) => artifact.type === 'pdf')
      )
      .toSorted(
        (first, second) => second.submissionNumber - first.submissionNumber
      )[0],
    completionEnabled: config.get('catchRecording.completionEnabled'),
    submissions: submissions.submissions,
    recordPath: `/records/${encodeURIComponent(record.id)}`,
    backLink: { href: '/records', text: 'Back' },
    actionKey: request.yar.get('recordAction').key
  })
}

function requireRecordAction(request) {
  if (
    request.params.action === 'complete' &&
    !config.get('catchRecording.completionEnabled')
  ) {
    throw Boom.notFound()
  }
  const action = request.yar.get('recordAction')
  if (
    !action ||
    action.id !== request.params.recordId ||
    request.payload?.actionKey !== action.key
  ) {
    throw Boom.badRequest('Open the record before taking this action')
  }
  return action
}

async function deleteRecordAction(request, h, client, input) {
  await client.deleteRecord(input)
  if (getJourneyState(request).catchRecordId === input.catchRecordId) {
    request.yar.set('journey', {})
  }
  request.yar.clear('recordAction')
  return h.redirect('/records').code(statusCodes.seeOther)
}

async function completeRecordAction(request, h, client, input, record) {
  if (record.status !== 'SUBMITTED') {
    throw Boom.conflict('Only a submitted catch record may be completed')
  }
  await client.completeRecord(input)
  request.yar.clear('recordAction')
  return h
    .redirect(`/records/${encodeURIComponent(input.catchRecordId)}`)
    .code(statusCodes.seeOther)
}

async function openRecordJourney(request, h, client, input, record) {
  const journey = recordJourney(record)
  const editing = request.params.action === 'edit'
  if (!editing && record.status !== 'DRAFT') {
    throw Boom.conflict('Only a draft can be resumed')
  }
  if (editing && record.status === 'SUBMITTED') {
    return h
      .redirect(`/records/${encodeURIComponent(record.id)}/edit-reason`)
      .code(statusCodes.seeOther)
  }
  if (editing) {
    const saved = await client.startEdit(input)
    journey.version = saved.version
  }
  request.yar.set('journey', journey)
  request.yar.clear('recordAction')
  return h.redirect('/trip-date').code(statusCodes.seeOther)
}

export async function recordAction(request, h) {
  const action = requireRecordAction(request)
  const { client, correlationId } = catchRecordService()
  const input = {
    catchRecordId: action.id,
    version: action.version,
    idempotencyKey: action.key,
    correlationId
  }
  if (request.params.action === 'delete') {
    return deleteRecordAction(request, h, client, input)
  }
  const record = await client.getRecord(input)
  if (request.params.action === 'complete') {
    return completeRecordAction(request, h, client, input, record)
  }
  return openRecordJourney(request, h, client, input, record)
}

export async function showHistory(request, h) {
  const { client, correlationId } = catchRecordService()
  const input = {
    catchRecordId: request.params.recordId,
    correlationId
  }
  const [history, record] = await Promise.all([
    client.getHistory(input),
    client.getRecord(input)
  ])
  return h.view('live-records/history', {
    pageTitle: 'Catch record history',
    history: { ...history, displayStatus: getRecordDisplayStatus(record) },
    backLink: {
      href: `/records/${encodeURIComponent(request.params.recordId)}`,
      text: 'Back'
    }
  })
}

export async function downloadArtifact(request, h) {
  const { client, correlationId } = catchRecordService()
  const { artifactType, submissionNumber, recordId } = request.params
  const artifact = await client.downloadArtifact({
    catchRecordId: recordId,
    artifactType,
    submissionNumber,
    correlationId
  })
  return h
    .response(artifact.body)
    .type(artifactType === 'pdf' ? 'application/pdf' : 'application/json')
    .header(
      'Content-Disposition',
      `attachment; filename="catch-record-${submissionNumber}.${artifactType}"`
    )
    .header('Cache-Control', 'private, no-store')
}

export async function submitLiveRecord(request, h) {
  const state = getJourneyState(request)
  if (state.catchRecordPendingTrip) {
    throw Boom.badRequest(
      'Complete the trip dates and both ports before submitting',
      { catchRecordError: true }
    )
  }
  if (state.catchRecordReloadRequired) {
    throw Boom.conflict(
      'Reopen this record from Your catch records before submitting',
      { catchRecordError: true }
    )
  }
  if (request.payload?.submissionKey !== state.submissionKey) {
    throw Boom.badRequest('Review your record before submitting')
  }
  if (!state.catchRecordId || !state.submissionKey) {
    throw Boom.badRequest('Review your record before submitting')
  }
  const { client, correlationId } = catchRecordService()
  await saveReviewedRecord(request, client, correlationId)
  const reviewed = getJourneyState(request)
  const saved = await client.submitRecord({
    catchRecordId: state.catchRecordId,
    version: reviewed.submissionVersion,
    idempotencyKey: state.submissionKey,
    correlationId
  })
  setJourneyState(request, {
    version: saved.version,
    submittedRecordId: saved.id,
    reference: saved.catchRecordReference
  })
  return h.redirect('/confirmation').code(statusCodes.seeOther)
}

async function saveReviewedRecord(request, client, correlationId) {
  const state = getJourneyState(request)
  if (state.replacementSubmissionKey === state.submissionKey) {
    return
  }
  const record = await client.getRecord({
    catchRecordId: state.catchRecordId,
    correlationId
  })
  if (record.status !== 'DRAFT' || record.version !== state.submissionVersion) {
    throw Boom.conflict(
      'The record changed. Reopen it from Your catch records before submitting',
      { catchRecordError: true }
    )
  }
  let payload
  try {
    payload = await replacementPayload(request, record)
  } catch (error) {
    if (error instanceof MapStatisticalAreasReferenceDataError) {
      throw Boom.serverUnavailable(
        'Statistical-area reference data is temporarily unavailable',
        { catchRecordError: true }
      )
    }
    throw error
  }
  let saved
  try {
    saved = await client.replaceRecord({
      catchRecordId: state.catchRecordId,
      version: state.submissionVersion,
      payload,
      correlationId
    })
  } catch (error) {
    setJourneyState(request, { catchRecordReloadRequired: true })
    throw error
  }
  setJourneyState(request, {
    version: saved.version,
    submissionVersion: saved.version,
    replacementSubmissionKey: state.submissionKey
  })
}
