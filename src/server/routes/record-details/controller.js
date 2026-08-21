import Joi from 'joi'
import Boom from '@hapi/boom'

import { getData } from '#/server/common/data/get-data.js'

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
  handler(request, h) {
    const { recordId } = request.params
    const record = getData('allRecords').find(
      (item) => item.recordId === recordId
    )

    if (!record) {
      throw Boom.notFound()
    }

    const details = getData('catchRecordDetails')

    return h.view('record-details/index', {
      pageTitle: `Catch record for ${details.vesselName}`,
      heading: `Catch record for ${details.vesselName}`,
      backLink: {
        href: '/records',
        text: 'Back'
      },
      details,
      recordId
    })
  }
}
