import Joi from 'joi'

import { safeReturnPath } from '#/server/common/helpers/journey/navigation.js'

export const notImplementedController = {
  options: {
    validate: {
      query: Joi.object({
        return: Joi.string().optional()
      })
    }
  },
  handler(request, h) {
    return h.view('not-implemented/index', {
      pageTitle: 'Feature not available',
      heading: 'Feature not available',
      backLink: {
        href: safeReturnPath(request.query.return),
        text: 'Back'
      }
    })
  }
}
