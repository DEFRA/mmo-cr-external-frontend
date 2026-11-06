import { getData } from '#/server/common/data/get-data.js'
import Boom from '@hapi/boom'
import { liveCatchRecords } from '#/server/common/helpers/journey/catch-record-service.js'
import { getJourneyState } from '#/server/common/helpers/journey/navigation.js'

const pageTitle = 'Your catch record has been submitted'

export const confirmationController = {
  handler(request, h) {
    const state = getJourneyState(request)
    if (liveCatchRecords() && !state.submittedRecordId) {
      throw Boom.badRequest('Submit your record first')
    }
    const { reference } = liveCatchRecords() ? state : getData('confirmation')

    return h.view('confirmation/index', {
      pageTitle,
      heading: pageTitle,
      backLink: {
        href: '/records',
        text: 'Back'
      },
      reference
    })
  }
}
