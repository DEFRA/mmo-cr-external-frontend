import { getData } from '#/server/common/data/get-data.js'
import { getSpeciesPageData } from '#/server/common/helpers/species/species-list.js'
import { getGearCatalogue } from '#/server/common/helpers/gear/favourite-gear.js'
import {
  backForCheckAnswers,
  getJourneyState,
  incompleteGearPath
} from '#/server/common/helpers/journey/navigation.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import { buildCheckAnswersViewModel } from './view-model.js'
import { retrieveCatchRecord } from '#/server/common/helpers/journey/create-draft.js'
import { randomUUID } from 'node:crypto'
import Boom from '@hapi/boom'
import { setJourneyState } from '#/server/common/helpers/journey/navigation.js'
import { liveCatchRecords } from '#/server/common/helpers/journey/catch-record-service.js'
import { submitLiveRecord } from '../live-records/controller.js'
import { getAmendmentState } from '#/server/common/helpers/journey/amendment.js'

async function viewContext(request) {
  const { catalogue, journeyState } = await getSpeciesPageData(request)
  const gearCatalogue = await getGearCatalogue()
  const summary = buildCheckAnswersViewModel(request, {
    speciesCatalogue: catalogue,
    gearCatalogue,
    fallbackDetails: liveCatchRecords() ? {} : undefined,
    reviewLayout: true
  })
  const fallback = getData('catchRecordDetails')
  const heading = 'Check your catch record'

  return {
    pageTitle: heading,
    heading,
    backLink: {
      href: backForCheckAnswers(request),
      text: 'Back'
    },
    reference: journeyState.reference || fallback.reference,
    ...summary
  }
}

export const checkAnswersController = {
  async handler(request, h) {
    const amendment = getAmendmentState(request)
    if (
      liveCatchRecords() &&
      amendment.reasonProvided &&
      amendment.recordId === getJourneyState(request).catchRecordId
    ) {
      return h
        .redirect(
          `/records/${encodeURIComponent(amendment.recordId)}/edit-review`
        )
        .code(303)
    }
    if (liveCatchRecords() && !getJourneyState(request).catchRecordId) {
      throw Boom.badRequest('Start or resume a catch record first')
    }
    if (
      liveCatchRecords() &&
      getJourneyState(request).catchRecordReloadRequired
    ) {
      throw Boom.conflict(
        'Reopen this record from Your catch records before continuing',
        { catchRecordError: true }
      )
    }
    if (liveCatchRecords() && !getJourneyState(request).submissionKey) {
      setJourneyState(request, {
        submissionKey: randomUUID(),
        submissionVersion: getJourneyState(request).version
      })
    }
    const [context] = await Promise.all([
      viewContext(request),
      retrieveCatchRecord(request)
    ])
    return h.view('check-answers/index', {
      ...context,
      pendingTrip:
        liveCatchRecords() && getJourneyState(request).catchRecordPendingTrip,
      submissionKey: liveCatchRecords()
        ? getJourneyState(request).submissionKey
        : null
    })
  }
}

export const checkAnswersSubmitController = {
  handler(request, h) {
    const amendment = getAmendmentState(request)
    if (
      liveCatchRecords() &&
      amendment.reasonProvided &&
      amendment.recordId === getJourneyState(request).catchRecordId
    ) {
      return h
        .redirect(
          `/records/${encodeURIComponent(amendment.recordId)}/edit-review`
        )
        .code(303)
    }
    if (liveCatchRecords()) return submitLiveRecord(request, h)
    const incompletePath =
      incompleteGearPath(request) ||
      (!getJourneyState(request).selectedGearIds?.length
        ? '/gear-selection'
        : null)
    if (incompletePath) {
      return h.redirect(incompletePath).code(statusCodes.seeOther)
    }

    return h.redirect('/confirmation').code(statusCodes.seeOther)
  }
}
