import Joi from 'joi'
import Boom from '@hapi/boom'

import { getData } from '#/server/common/data/get-data.js'
import { getSpeciesCatalogue } from '#/server/common/helpers/species/species-list.js'
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

    const details = record.details || getData('catchRecordDetails')
    const summary = details.selectedGearIds
      ? buildCheckAnswersViewModel(request, {
          journeyState: details,
          speciesCatalogue: await getSpeciesCatalogue(request),
          gearCatalogue: await getGearCatalogue(),
          buildChangeHref: () => null,
          hideVesselChange: true
        })
      : {}

    return h.view('record-details/index', {
      pageTitle: `Catch record for ${details.vesselName}`,
      heading: `Catch record for ${details.vesselName}`,
      backLink: {
        href: '/records',
        text: 'Back'
      },
      details,
      ...summary,
      status: record.status,
      recordId
    })
  }
}
