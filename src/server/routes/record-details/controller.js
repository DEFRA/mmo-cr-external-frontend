import { t } from '#/server/common/helpers/i18n/translator.js'
import { localizeSummarySections } from '#/server/common/helpers/records/localize-summary.js'

import Joi from 'joi'
import Boom from '@hapi/boom'

import { getData } from '#/server/common/data/get-data.js'
import {
  getSpeciesCatalogue,
  getSpeciesPageData
} from '#/server/common/helpers/species/species-list.js'
import { getGearCatalogue } from '#/server/common/helpers/gear/favourite-gear.js'
import { buildCheckAnswersViewModel } from '#/server/routes/check-answers/view-model.js'
import { liveCatchRecords } from '#/server/common/helpers/journey/catch-record-service.js'
import { showLiveRecord } from '../live-records/controller.js'

/**
 * Dispatches by record status: all supported statuses (Unsent, Submitted,
 * Amended, Late) render the same read-only details view.
 */
export const recordDetailsController = {
  options: {
    validate: {
      params: Joi.object({
        recordId: Joi.string().required()
      })
    }
  },
  async handler(request, h) {
    if (liveCatchRecords()) {
      return showLiveRecord(request, h)
    }
    const { recordId } = request.params
    const record = getData('allRecords').find(
      (item) => item.recordId === recordId
    )

    if (!record) {
      throw Boom.notFound()
    }

    let details = record.details || getData('catchRecordDetails')
    let summary = {}
    if (record.status === 'amended') {
      const { journeyState, catalogue: speciesCatalogue } =
        await getSpeciesPageData(request)
      const gearCatalogue = await getGearCatalogue()
      details = {
        ...details,
        vesselName: journeyState.selectedVesselName || details.vesselName
      }
      summary = buildCheckAnswersViewModel(request, {
        speciesCatalogue,
        gearCatalogue,
        fallbackDetails: details,
        buildChangeHref: () => null
      })
    }

    if (record.status !== 'amended' && details.selectedGearIds) {
      summary = buildCheckAnswersViewModel(request, {
        journeyState: details,
        speciesCatalogue: await getSpeciesCatalogue(request),
        gearCatalogue: await getGearCatalogue(),
        buildChangeHref: () => null,
        fallbackDetails: details,
        hideVesselChange: true
      })
    }

    return h.view('record-details/index', {
      pageTitle: t('common.catchRecordFor', {
        vesselName: details.vesselName
      }),
      heading: t('common.catchRecordFor', {
        vesselName: details.vesselName
      }),
      backLink: {
        href: '/records',
        text: t('header.back')
      },
      details,
      ...summary,
      sections: localizeSummarySections(summary.sections),
      gearGroups: localizeSummarySections(summary.gearGroups),
      trailingSections: localizeSummarySections(summary.trailingSections),
      status: record.status,
      recordId
    })
  }
}
