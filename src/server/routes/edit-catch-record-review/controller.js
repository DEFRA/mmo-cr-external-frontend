import { t } from '#/server/common/helpers/i18n/translator.js'
import { localizeSummarySections } from '#/server/common/helpers/records/localize-summary.js'

import Joi from 'joi'
import Boom from '@hapi/boom'

import { getData } from '#/server/common/data/get-data.js'
import {
  getAmendmentState,
  clearAmendmentState
} from '#/server/common/helpers/journey/amendment.js'
import { buildCheckAnswersViewModel } from '#/server/routes/check-answers/view-model.js'
import { getSpeciesPageData } from '#/server/common/helpers/species/species-list.js'
import { getGearCatalogue } from '#/server/common/helpers/gear/favourite-gear.js'
import { formatDate } from '#/config/nunjucks/filters/format-date.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import { liveCatchRecords } from '#/server/common/helpers/journey/catch-record-service.js'
import { liveReview, resubmitAmendment } from './live-amendment.js'

const AMENDMENT_CHANGE_HREF = '/not-implemented?return=/records'

function findRecord(recordId) {
  const record = getData('allRecords').find(
    (item) => item.recordId === recordId
  )

  if (!record) {
    throw Boom.notFound()
  }

  return record
}

async function viewContext(request, recordId, overrides = {}) {
  const record = findRecord(recordId)
  const details = record.details || getData('catchRecordDetails')
  const { catalogue, journeyState } = await getSpeciesPageData(request)
  const gearCatalogue =
    journeyState.selectedGearIds?.length || details.selectedGearIds
      ? await getGearCatalogue()
      : undefined
  const vesselName = journeyState.selectedVesselName || details.vesselName
  let summaryJourneyState = journeyState
  if (!journeyState.selectedGearIds?.length && details.selectedGearIds) {
    summaryJourneyState = details
  }
  const summary = buildCheckAnswersViewModel(request, {
    journeyState: summaryJourneyState,
    buildChangeHref: () => AMENDMENT_CHANGE_HREF,
    hideVesselChange: true,
    speciesCatalogue: catalogue,
    gearCatalogue,
    fallbackDetails: details
  })
  const heading =
    record.recordId === 'late-1'
      ? t('editReview.titleToEdit', { vessel: vesselName })
      : t('editReview.titleForRecord', { vessel: vesselName })

  return {
    pageTitle: heading,
    heading,
    reference: details.reference,
    notification: {
      titleText: t('common.important'),
      html: [
        `<p class="govuk-body govuk-!-font-weight-bold govuk-!-margin-bottom-1">${t('editReview.banner.submitted')}</p>`,
        `<p class="govuk-body">${formatDate(details.submittedDate, 'd MMMM yyyy')} ${details.submittedTime}</p>`,
        `<p class="govuk-body govuk-!-font-weight-bold govuk-!-margin-bottom-1">${t('editReview.banner.submittedBy')}</p>`,
        `<p class="govuk-body">${details.submittedBy}</p>`
      ].join('')
    },
    backLink: {
      href: `/records/${recordId}`,
      text: t('header.back')
    },
    ...summary,
    sections: localizeSummarySections(summary.sections),
    gearGroups: localizeSummarySections(summary.gearGroups),
    trailingSections: localizeSummarySections(summary.trailingSections),
    ...overrides
  }
}

// True only when the amendment reason for this exact record is still held in session.
function hasValidAmendment(request, recordId) {
  const amendment = getAmendmentState(request)
  return amendment.recordId === recordId && amendment.reasonProvided === true
}

export const editCatchRecordReviewController = {
  options: {
    validate: {
      params: Joi.object({
        recordId: Joi.string().required()
      })
    }
  },
  async handler(request, h) {
    if (liveCatchRecords()) {
      return liveReview(request, h)
    }
    const { recordId } = request.params
    findRecord(recordId)

    if (!hasValidAmendment(request, recordId)) {
      return h
        .redirect(`/records/${recordId}/edit-reason`)
        .code(statusCodes.found)
    }

    return h.view(
      'edit-catch-record-review/index',
      await viewContext(request, recordId)
    )
  }
}

const confirmAccurateError = () => t('editReview.error.confirmDeclaration')

export const editCatchRecordReviewSubmitController = {
  options: {
    validate: {
      params: Joi.object({
        recordId: Joi.string().required()
      }),
      payload: Joi.object({
        confirmAccurate: Joi.string().valid('true').required(),
        submissionKey: Joi.string().uuid().optional()
      }),
      async failAction(request, h) {
        if (liveCatchRecords()) {
          const response = await liveReview(
            request,
            h,
            {
              errorSummary: {
                titleText: t('common.errorSummary.title'),
                errorList: [
                  { text: confirmAccurateError(), href: '#confirmAccurate' }
                ]
              },
              fieldErrors: { confirmAccurate: confirmAccurateError() }
            },
            statusCodes.badRequest
          )
          return response.takeover()
        }
        const { recordId } = request.params
        findRecord(recordId)

        if (!hasValidAmendment(request, recordId)) {
          return h
            .redirect(`/records/${recordId}/edit-reason`)
            .code(statusCodes.found)
            .takeover()
        }

        return h
          .view(
            'edit-catch-record-review/index',
            await viewContext(request, recordId, {
              errorSummary: {
                titleText: t('common.errorSummary.title'),
                errorList: [
                  { text: confirmAccurateError(), href: '#confirmAccurate' }
                ]
              },
              fieldErrors: { confirmAccurate: confirmAccurateError() }
            })
          )
          .code(statusCodes.badRequest)
          .takeover()
      }
    }
  },
  handler(request, h) {
    if (liveCatchRecords()) {
      return resubmitAmendment(request, h)
    }
    const { recordId } = request.params
    findRecord(recordId)

    if (!hasValidAmendment(request, recordId)) {
      return h
        .redirect(`/records/${recordId}/edit-reason`)
        .code(statusCodes.found)
    }

    clearAmendmentState(request)

    return h.redirect('/confirmation').code(statusCodes.seeOther)
  }
}
