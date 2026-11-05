import { randomUUID } from 'node:crypto'
import Boom from '@hapi/boom'
import { catchRecordService } from '#/server/common/helpers/journey/catch-record-service.js'
import {
  getJourneyState,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import {
  getAmendmentState,
  setAmendmentState,
  clearAmendmentState
} from '#/server/common/helpers/journey/amendment.js'
import { recordJourney } from '#/server/common/helpers/journey/catch-record-mapping.js'
import { getSpeciesPageData } from '#/server/common/helpers/species/species-list.js'
import { getGearCatalogue } from '#/server/common/helpers/gear/favourite-gear.js'
import { buildCheckAnswersViewModel } from '#/server/routes/check-answers/view-model.js'
import { submitLiveRecord } from '#/server/routes/live-records/controller.js'

export async function amendmentRecord(request) {
  const { client, correlationId } = catchRecordService()
  return client.getRecord({
    catchRecordId: request.params.recordId,
    correlationId
  })
}

export async function reasonContext(request, overrides = {}) {
  const record = await amendmentRecord(request)
  if (record.status !== 'SUBMITTED') {
    throw Boom.conflict(
      'Only a submitted catch record can be opened for editing'
    )
  }
  const existing = getAmendmentState(request)
  const action =
    existing.recordId === record.id &&
    existing.version === record.version &&
    existing.key
      ? existing
      : { recordId: record.id, version: record.version, key: randomUUID() }
  if (action !== existing) clearAmendmentState(request)
  setAmendmentState(request, action)
  return {
    pageTitle: 'Why are you editing this catch record?',
    heading: 'Why are you editing this catch record?',
    reference: record.catchRecordReference,
    tripEndDate: record.trip.dateEnded,
    reasonKey: action.key,
    backLink: {
      href: `/records/${encodeURIComponent(record.id)}`,
      text: 'Back'
    },
    ...overrides
  }
}

export async function startAmendment(request, h) {
  const amendment = getAmendmentState(request)
  const path = `/records/${encodeURIComponent(request.params.recordId)}`
  if (
    amendment.recordId !== request.params.recordId ||
    !amendment.key ||
    amendment.key !== request.payload.reasonKey
  ) {
    throw Boom.badRequest('Open the edit reason page before continuing')
  }
  if (
    amendment.reasonProvided &&
    getJourneyState(request).catchRecordId === amendment.recordId
  ) {
    return h.redirect(`${path}/edit-review`).code(303)
  }
  const record = await amendmentRecord(request)
  if (record.status !== 'SUBMITTED' || record.version !== amendment.version) {
    throw Boom.conflict('This record changed. Reopen it before editing')
  }
  const journey = recordJourney(record)
  const { client, correlationId } = catchRecordService()
  const saved = await client.startEdit({
    catchRecordId: record.id,
    version: amendment.version,
    idempotencyKey: amendment.key,
    correlationId
  })
  request.yar.set('journey', { ...journey, version: saved.version })
  setAmendmentState(request, {
    reasonProvided: true,
    editReason: request.payload.editReason,
    submittedAt: record.submittedAt,
    submittedBy: record.submittedBy
  })
  return h.redirect(`${path}/edit-review`).code(303)
}

export function validLiveAmendment(request) {
  const amendment = getAmendmentState(request)
  const state = getJourneyState(request)
  return (
    amendment.recordId === request.params.recordId &&
    amendment.reasonProvided === true &&
    state.catchRecordId === request.params.recordId
  )
}

export async function liveReview(request, h, overrides = {}, status = 200) {
  if (!validLiveAmendment(request)) {
    return h
      .redirect(
        `/records/${encodeURIComponent(request.params.recordId)}/edit-reason`
      )
      .code(303)
  }
  const state = getJourneyState(request)
  if (state.catchRecordReloadRequired) {
    throw Boom.conflict(
      'Reopen this record from Your catch records before continuing'
    )
  }
  const record = await amendmentRecord(request)
  if (record.status !== 'DRAFT' || record.version !== state.version) {
    throw Boom.conflict('This record changed. Reopen it before continuing')
  }
  const { catalogue, journeyState } = await getSpeciesPageData(request)
  const gearCatalogue = await getGearCatalogue()
  const summary = buildCheckAnswersViewModel(request, {
    journeyState,
    speciesCatalogue: catalogue,
    gearCatalogue,
    fallbackDetails: {},
    readOnly: true,
    editableDetails: true
  })
  if (!state.submissionKey) {
    setJourneyState(request, {
      submissionKey: randomUUID(),
      submissionVersion: state.version
    })
  }
  const amendment = getAmendmentState(request)
  const heading = `Edit catch record for ${record.vessel.nameSnapshot}`
  return h
    .view('edit-catch-record-review/index', {
      ...summary,
      pageTitle: heading,
      heading,
      reference: record.catchRecordReference,
      liveAmendment: true,
      submittedAt: amendment.submittedAt,
      submittedBy: amendment.submittedBy,
      submissionKey: getJourneyState(request).submissionKey,
      backLink: {
        href: `/records/${encodeURIComponent(record.id)}`,
        text: 'Back'
      },
      ...overrides
    })
    .code(status)
}

export async function resubmitAmendment(request, h) {
  if (!validLiveAmendment(request)) {
    throw Boom.badRequest('Open the amendment review before submitting')
  }
  const response = await submitLiveRecord(request, h)
  clearAmendmentState(request)
  return response
}
