import Joi from 'joi'
import Boom from '@hapi/boom'

import { getData } from '#/server/common/data/get-data.js'
import { getSpeciesPageData } from '#/server/common/helpers/species/species-list.js'
import { getGearCatalogue } from '#/server/common/helpers/gear/favourite-gear.js'
import { buildCheckAnswersViewModel } from '#/server/routes/check-answers/view-model.js'

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
    const { recordId } = request.params
    const record = getData('allRecords').find(
      (item) => item.recordId === recordId
    )

    if (!record) {
      throw Boom.notFound()
    }

    let details = record.details || getData('catchRecordDetails')
    let sections
    if (record.status === 'amended') {
      const { journeyState, catalogue } = await getSpeciesPageData(request)
      const gearCatalogue = await getGearCatalogue()
      details = {
        ...details,
        vesselName: journeyState.selectedVesselName || details.vesselName
      }
      sections = buildCheckAnswersViewModel(request, {
        speciesCatalogue: catalogue,
        gearCatalogue,
        fallbackDetails: details,
        buildChangeHref: () => null
      }).sections
    }

    return h.view('record-details/index', {
      pageTitle: `Catch record for ${details.vesselName}`,
      heading: `Catch record for ${details.vesselName}`,
      backLink: {
        href: '/records',
        text: 'Back'
      },
      details,
      sections,
      status: record.status,
      recordId
    })
  }
}
