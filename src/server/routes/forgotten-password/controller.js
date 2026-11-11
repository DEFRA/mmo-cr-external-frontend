import Joi from 'joi'

import { config } from '#/config/config.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import { createEntraAuthorizationUrl } from '#/server/common/helpers/auth/entra.js'

const heading = 'Forgotten your password?'
const templatePath = 'forgotten-password/index'
const confirmationEmailKey = 'forgottenPasswordEmail'

async function redirectToEntraSignIn(request, h, takeover = false) {
  const authorizationUrl = await createEntraAuthorizationUrl(request)
  const response = h.redirect(authorizationUrl).code(statusCodes.seeOther)

  return takeover ? response.takeover() : response
}

function viewContext(overrides = {}) {
  return {
    pageTitle: heading,
    heading,
    backLink: { href: '/sign-in', text: 'Back' },
    ...overrides
  }
}

export const forgottenPasswordController = {
  async handler(request, h) {
    if (config.get('authentication.mode') === 'entra') {
      return redirectToEntraSignIn(request, h)
    }

    return h.view(templatePath, viewContext())
  }
}

export const forgottenPasswordSubmitController = {
  options: {
    validate: {
      payload: Joi.object({
        email: Joi.string()
          .trim()
          .email({ tlds: { allow: false } })
          .required()
      }),
      async failAction(request, h) {
        if (config.get('authentication.mode') === 'entra') {
          return redirectToEntraSignIn(request, h, true)
        }

        const email =
          typeof request.payload?.email === 'string'
            ? request.payload.email
            : ''
        const errorText = email.trim()
          ? 'Enter an email address in the correct format, like name@example.com'
          : 'Enter your email address'

        return h
          .view(
            templatePath,
            viewContext({
              email,
              fieldErrors: { email: errorText },
              errorSummary: {
                titleText: 'There is a problem',
                errorList: [{ text: errorText, href: '#email' }]
              }
            })
          )
          .code(statusCodes.badRequest)
          .takeover()
      }
    }
  },
  handler(request, h) {
    if (config.get('authentication.mode') === 'entra') {
      return redirectToEntraSignIn(request, h)
    }

    request.yar.flash(confirmationEmailKey, request.payload.email)
    return h
      .redirect('/forgotten-password-confirmation')
      .code(statusCodes.seeOther)
  }
}

export const forgottenPasswordConfirmationController = {
  async handler(request, h) {
    if (config.get('authentication.mode') === 'entra') {
      return redirectToEntraSignIn(request, h)
    }

    const email = request.yar.flash(confirmationEmailKey).at(-1)
    if (!email) {
      return h.redirect('/forgotten-password').code(statusCodes.seeOther)
    }
    return h.view(
      templatePath,
      viewContext({
        pageTitle: 'A reset password email has been sent',
        heading: 'A reset password email has been sent to',
        backLink: null,
        email,
        sent: true
      })
    )
  }
}
