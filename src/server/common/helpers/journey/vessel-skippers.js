import { randomUUID } from 'node:crypto'
import Boom from '@hapi/boom'
import { getJourneyState, setJourneyState } from './navigation.js'
import { catchRecordService, liveCatchRecords } from './catch-record-service.js'

export function requireSkipperVessel(request) {
  const vesselId = getJourneyState(request).selectedVesselId
  if (!vesselId) {
    throw Boom.badRequest('Select a vessel before managing saved skippers', {
      catchRecordError: true
    })
  }
  return vesselId
}

function vesselInput(request) {
  return { ...catchRecordService(), vesselId: requireSkipperVessel(request) }
}

function storeSkippers(request, result) {
  return setJourneyState(request, {
    skippersVesselId: result.vesselId,
    vesselSkippers: result.skippers
  })
}

export async function loadVesselSkippers(request) {
  if (!liveCatchRecords()) return getJourneyState(request)
  const { client, ...input } = vesselInput(request)
  return storeSkippers(request, await client.listSkippers(input))
}

export function savePendingSkipper(request, details) {
  const vesselId = requireSkipperVessel(request)
  const state = getJourneyState(request)
  const unchanged =
    state.pendingSkipperVesselId === vesselId &&
    JSON.stringify(state.pendingSkipper) === JSON.stringify(details)
  return setJourneyState(request, {
    pendingSkipper: details,
    pendingSkipperVesselId: vesselId,
    skipperAdditionKey:
      unchanged && state.skipperAdditionKey
        ? state.skipperAdditionKey
        : randomUUID(),
    skipperConfirmed: false,
    skipperConfirmedVesselId: null
  })
}

export function requirePendingSkipper(request) {
  const state = getJourneyState(request)
  const vesselId = requireSkipperVessel(request)
  if (
    state.pendingSkipperVesselId !== vesselId ||
    !state.pendingSkipper ||
    !state.skipperAdditionKey
  ) {
    throw Boom.badRequest(
      'Enter skipper details for the selected vessel first',
      {
        catchRecordError: true
      }
    )
  }
  return state.pendingSkipper
}

export async function addPendingVesselSkipper(request) {
  const details = requirePendingSkipper(request)
  const vesselId = requireSkipperVessel(request)
  const state = getJourneyState(request)
  if (state.skipperConfirmed && state.skipperConfirmedVesselId === vesselId) {
    return
  }
  const { client, ...input } = vesselInput(request)
  const result = await client.addSkipper({
    ...input,
    skipper: {
      name: `${details.firstName} ${details.lastName}`,
      ...(details.email ? { email: details.email } : {}),
      ...(details.phoneNumber ? { phoneNumber: details.phoneNumber } : {})
    },
    idempotencyKey: state.skipperAdditionKey
  })
  storeSkippers(request, result)
  setJourneyState(request, {
    skipperConfirmed: true,
    skipperConfirmedVesselId: result.vesselId
  })
}

export async function removeVesselSkippers(request, skipperIds) {
  const { client, ...input } = vesselInput(request)
  for (const skipperId of skipperIds) {
    await client.removeSkipper({ ...input, skipperId })
    const state = getJourneyState(request)
    storeSkippers(request, {
      vesselId: input.vesselId,
      skippers: state.vesselSkippers.filter(
        (skipper) => skipper.id !== skipperId
      )
    })
  }
}
