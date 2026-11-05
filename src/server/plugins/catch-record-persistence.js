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
import { MapStatisticalAreasReferenceDataError } from '#/server/common/clients/map-statistical-areas-reference-data.js'
import {
  businessDate,
  sectionData
} from '#/server/common/helpers/journey/catch-record-payload.js'

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
      if (!before || request.response.statusCode !== 303) return h.continue
      if (
        request.route.path === '/confirm-same-port' &&
        request.payload.confirmSamePort === 'no'
      ) {
        return h.continue
      }
      if (isDeepStrictEqual(before, getJourneyState(request))) return h.continue
      let mutationAttempted = false
      try {
        const sections = [SECTION_ROUTES[request.route.path]].flat()
        const { client, correlationId } = catchRecordService()
        if (
          request.route.path === '/trip-date' &&
          getJourneyState(request).tripSameDate
        ) {
          setJourneyState(request, {
            departureDate: businessDate(),
            returnDate: businessDate()
          })
        }
        for (const section of sections) {
          const current = getJourneyState(request)
          if (
            section === 'trip' &&
            (typeof current.tripSameDate !== 'boolean' ||
              !current.departurePort ||
              !current.returnPort ||
              (current.tripSameDate === false &&
                (!current.departureDate || !current.returnDate)))
          ) {
            setJourneyState(request, {
              catchRecordPendingTrip: true,
              submissionKey: null,
              submissionVersion: null
            })
            continue
          }
          if (
            section === 'speciesNotLanded' &&
            isDeepStrictEqual(
              before.speciesNotLanded,
              getJourneyState(request).speciesNotLanded
            )
          ) {
            continue
          }
          const data = await sectionData(request, section)
          mutationAttempted = true
          const saved = await client.saveSection({
            catchRecordId: before.catchRecordId,
            version: getJourneyState(request).version,
            section,
            data,
            correlationId
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
            const canonical = await client.getRecord({
              catchRecordId: before.catchRecordId,
              correlationId
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
        }
      } catch (error) {
        request.yar.set('journey', {
          ...before,
          ...(mutationAttempted ? { catchRecordReloadRequired: true } : {})
        })
        if (error instanceof MapStatisticalAreasReferenceDataError) {
          throw Boom.serverUnavailable(
            'Statistical-area reference data is temporarily unavailable',
            { catchRecordError: true }
          )
        }
        throw error
      }
      return h.continue
    })
  }
}
