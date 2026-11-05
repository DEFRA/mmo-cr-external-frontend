import { isDeepStrictEqual } from 'node:util'
import Boom from '@hapi/boom'
import {
  getJourneyState,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import {
  catchRecordService,
  liveCatchRecords
} from '#/server/common/helpers/journey/catch-record-service.js'
import { recordJourney } from '#/server/common/helpers/journey/catch-record-mapping.js'
import { forEachSequentially } from '#/server/common/helpers/sequential.js'
import { MapStatisticalAreasReferenceDataError } from '#/server/common/clients/map-statistical-areas-reference-data.js'
import {
  businessDate,
  sectionData
} from '#/server/common/helpers/journey/catch-record-payload.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

const SECTION_ROUTES = {
  '/trip-date': 'trip',
  '/trip-departure-date': 'trip',
  '/trip-return-date': 'trip',
  '/departure-port': 'trip',
  '/return-port': 'trip',
  '/confirm-same-port': 'trip',
  '/add-port': 'trip',
  '/gear-selection': 'gears',
  '/statistical-area': 'gears',
  '/statistical-area-other': 'gears',
  '/species-selection': 'gears',
  '/catch-not-landed': 'speciesNotLanded',
  '/species-not-landed': 'speciesNotLanded'
}

function shouldSkipSave(request, before) {
  if (!before || request.response.statusCode !== statusCodes.seeOther) {
    return true
  }
  if (
    request.route.path === '/confirm-same-port' &&
    request.payload.confirmSamePort === 'no'
  ) {
    return true
  }
  return isDeepStrictEqual(before, getJourneyState(request))
}

function hasTripDates(state) {
  return (
    state.tripSameDate !== false ||
    Boolean(state.departureDate && state.returnDate)
  )
}

function isTripIncomplete(state) {
  return (
    typeof state.tripSameDate !== 'boolean' ||
    !state.departurePort ||
    !state.returnPort ||
    !hasTripDates(state)
  )
}

function shouldSkipSection(request, section, before) {
  if (section === 'trip' && isTripIncomplete(getJourneyState(request))) {
    setJourneyState(request, {
      catchRecordPendingTrip: true,
      submissionKey: null,
      submissionVersion: null
    })
    return true
  }
  return (
    section === 'speciesNotLanded' &&
    isDeepStrictEqual(
      before.speciesNotLanded,
      getJourneyState(request).speciesNotLanded
    )
  )
}

async function syncGearAssociations(request, before, saved, service) {
  const canonical = await service.client.getRecord({
    catchRecordId: before.catchRecordId,
    correlationId: service.correlationId
  })
  if (canonical.version !== saved.version) {
    throw Boom.conflict(
      'The record changed during saving. Reopen it from Your catch records.',
      { catchRecordError: true }
    )
  }
  setJourneyState(request, {
    gearAssociationIds: recordJourney(canonical).gearAssociationIds
  })
}

async function saveSection(request, section, before, service, progress) {
  const data = await sectionData(request, section)
  progress.mutationAttempted = true
  const saved = await service.client.saveSection({
    catchRecordId: before.catchRecordId,
    version: getJourneyState(request).version,
    section,
    data,
    correlationId: service.correlationId
  })
  setJourneyState(request, {
    version: saved.version,
    submissionKey: null,
    submissionVersion: null,
    submittedRecordId: null
  })
  if (section === 'trip') {
    setJourneyState(request, { catchRecordPendingTrip: false })
  }
  if (section === 'gears') {
    await syncGearAssociations(request, before, saved, service)
  }
}

async function saveChangedSections(request, before, progress) {
  const sections = [SECTION_ROUTES[request.route.path]].flat()
  const service = catchRecordService()
  if (
    request.route.path === '/trip-date' &&
    getJourneyState(request).tripSameDate
  ) {
    setJourneyState(request, {
      departureDate: businessDate(),
      returnDate: businessDate()
    })
  }
  await forEachSequentially(sections, async (section) => {
    if (!shouldSkipSection(request, section, before)) {
      await saveSection(request, section, before, service, progress)
    }
  })
}

function restoreBeforeFailure(request, before, mutationAttempted) {
  request.yar.set('journey', {
    ...before,
    ...(mutationAttempted ? { catchRecordReloadRequired: true } : {})
  })
}

function toPersistenceError(error) {
  if (error instanceof MapStatisticalAreasReferenceDataError) {
    return Boom.serverUnavailable(
      'Statistical-area reference data is temporarily unavailable',
      { catchRecordError: true }
    )
  }
  return error
}

export const catchRecordPersistence = {
  name: 'catch-record-persistence',
  register(server) {
    server.ext('onPreHandler', (request, h) => {
      const section = SECTION_ROUTES[request.route.path]
      if (
        request.route.path === '/add-port' &&
        (!request.query.for || request.query.return === '/account')
      ) {
        return h.continue
      }
      if (liveCatchRecords() && request.method === 'post' && section) {
        const state = getJourneyState(request)
        if (state.catchRecordReloadRequired) {
          throw Boom.conflict(
            'Reopen this record from Your catch records before saving again',
            { catchRecordError: true }
          )
        }
        if (!state.catchRecordId) {
          throw Boom.badRequest('Start or resume a catch record first')
        }
        request.app.catchRecordBeforeSave = structuredClone(state)
      }
      return h.continue
    })
    server.ext('onPostHandler', async (request, h) => {
      const before = request.app.catchRecordBeforeSave
      if (shouldSkipSave(request, before)) {
        return h.continue
      }
      const progress = { mutationAttempted: false }
      try {
        await saveChangedSections(request, before, progress)
      } catch (error) {
        restoreBeforeFailure(request, before, progress.mutationAttempted)
        throw toPersistenceError(error)
      }
      return h.continue
    })
  }
}
