import { randomUUID } from 'node:crypto'
import { getJourneyState, setJourneyState } from './navigation.js'
import { catchRecordService, liveCatchRecords } from './catch-record-service.js'

export function prepareDraftCreation(request) {
  const state = getJourneyState(request)
  if (!state.draftCreationKey && !state.catchRecordId) {
    setJourneyState(request, { draftCreationKey: randomUUID() })
  }
}

export async function ensureCatchRecordDraft(request, vessel) {
  const state = getJourneyState(request)
  const existingVesselId = state.draftVesselId || state.selectedVesselId
  if (
    (state.catchRecordId || state.draftVesselId) &&
    existingVesselId !== vessel.id
  ) {
    return false
  }
  if (state.catchRecordId) {
    return true
  }

  const { client, correlationId } = catchRecordService()
  prepareDraftCreation(request)
  setJourneyState(request, { draftVesselId: vessel.id })

  const draft = await client.createDraft({
    vesselId: vessel.id,
    idempotencyKey: getJourneyState(request).draftCreationKey,
    correlationId
  })

  setJourneyState(request, {
    catchRecordId: draft.id,
    reference: draft.catchRecordReference,
    version: draft.version
  })
  return true
}

export async function retrieveCatchRecord(request) {
  const { catchRecordId } = getJourneyState(request)
  if (!catchRecordId) {
    return null
  }
  const { client, correlationId } = catchRecordService()
  const input = {
    catchRecordId,
    correlationId
  }
  return liveCatchRecords()
    ? client.getRecord(input)
    : client.getCatchRecord(input)
}
