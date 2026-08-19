import Joi from 'joi'
import Boom from '@hapi/boom'

import { sampleRecords } from '#/server/common/helpers/journey/records.js'

/**
 * Dispatches by record status: an unsent record has no details yet and
 * continues its draft; other statuses render a read-only placeholder.
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
    const record = sampleRecords.find((item) => item.recordId === recordId)

    if (!record) {
      throw Boom.notFound()
    }

    if (record.status === 'unsent') {
      return h.redirect('/draft').code(302)
    }

    return h.view('record-details/index', {
      pageTitle: 'Catch record details',
      heading: 'Catch record details',
      backLink: {
        href: '/records',
        text: 'Back'
      },
      recordId
    })
  }
}
