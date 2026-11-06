import Boom from '@hapi/boom'
import { getTraceId } from '@defra/hapi-tracing'
import { config } from '#/config/config.js'
import { createCatchRecordingClient } from '#/server/common/clients/catch-recording.js'

export function liveCatchRecords() {
  return config.get('catchRecording.enabled')
}

export function catchRecordService() {
  if (
    !['local', 'dev', 'test'].includes(config.get('catchRecording.environment'))
  ) {
    throw Boom.serverUnavailable(
      'Mock catch recording authentication is not permitted'
    )
  }
  const client = createCatchRecordingClient({
    serviceUrl: config.get('catchRecording.serviceUrl'),
    token: config.get('catchRecording.token'),
    timeoutMs: config.get('catchRecording.timeoutMs'),
    tracingHeader: config.get('tracing.header')
  })
  return { client, correlationId: getTraceId() }
}
