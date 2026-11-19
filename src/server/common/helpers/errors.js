import { statusCodes } from '../constants/status-codes.js'
import { config } from '#/config/config.js'
import { t } from '#/server/common/helpers/i18n/translator.js'

function statusCodeMessage(statusCode) {
  switch (statusCode) {
    case statusCodes.notFound:
      return t('errors.notFound')
    case statusCodes.forbidden:
      return t('errors.forbidden')
    case statusCodes.unauthorized:
      return t('errors.unauthorised')
    case statusCodes.badRequest:
      return t('errors.badRequest')
    default:
      return t('errors.generic')
  }
}

export function catchAll(request, h) {
  const { response } = request

  if (!('isBoom' in response)) {
    return h.continue
  }

  const statusCode = response.output.statusCode
  const errorMessage = response.data?.catchRecordError
    ? response.message
    : statusCodeMessage(statusCode)

  const serverError = statusCode >= statusCodes.internalServerError
  const diagnosticClientError =
    statusCode >= statusCodes.badRequest &&
    statusCode < statusCodes.internalServerError &&
    ['dev', 'test'].includes(config.get('catchRecording.environment'))

  if (serverError || diagnosticClientError) {
    const level = serverError ? 'error' : 'warn'
    request.logger[level](
      {
        err: response,
        method: request.method,
        path: request.path,
        statusCode
      },
      'Request failed'
    )
  }

  return h
    .view('error/index', {
      pageTitle: errorMessage,
      heading: statusCode,
      message: errorMessage
    })
    .code(statusCode)
}
