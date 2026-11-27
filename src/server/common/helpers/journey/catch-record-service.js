import Boom from '@hapi/boom'
import { getTraceId } from '@defra/hapi-tracing'
import { config } from '#/config/config.js'
import { createCatchRecordingClient } from '#/server/common/clients/catch-recording.js'
import {
  getAccessToken,
  isEntraMode
} from '#/server/common/helpers/auth/entra.js'

export function liveCatchRecords() {
  return config.get('catchRecording.enabled')
}

function userAccessToken(request) {
  return async () => {
    const token = await getAccessToken(request)
    if (!token) {
      throw Boom.unauthorized('No backend access token in the session')
    }
    return token
  }
}

function staticServiceToken() {
  if (
    !['local', 'dev', 'test'].includes(config.get('catchRecording.environment'))
  ) {
    throw Boom.serverUnavailable(
      'Mock catch recording authentication is not permitted'
    )
  }
  return config.get('catchRecording.token')
}

export function catchRecordService(request) {
  const client = createCatchRecordingClient({
    serviceUrl: config.get('catchRecording.serviceUrl'),
    token: isEntraMode() ? userAccessToken(request) : staticServiceToken(),
    timeoutMs: config.get('catchRecording.timeoutMs'),
    tracingHeader: config.get('tracing.header')
  })
  return { client, correlationId: getTraceId() }
}
