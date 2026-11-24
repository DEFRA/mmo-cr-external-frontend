import { t } from '#/server/common/helpers/i18n/translator.js'

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
      pageTitle: t('web.not-implemented.controller.js.copy.17.1'),
      heading: t('web.not-implemented.controller.js.copy.18.1'),
      backLink: {
        href: safeReturnPath(request.query.return),
        text: t('header.back')
      }
    })
  }
}
