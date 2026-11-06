import Boom from '@hapi/boom'

import { statusCodes } from '#/server/common/constants/status-codes.js'
import {
  INVALID_RECORD_MESSAGE,
  JSON_CONTENT_TYPE,
  NOT_CONFIGURED_MESSAGE,
  RECORD_STATUSES,
  UNAVAILABLE_MESSAGE,
  catchRecordState,
  errorFromStatus,
  favouritesPath,
  hasSkipperNamed,
  isNonEmptyString,
  isPositiveInteger,
  isSuccessStatus,
  isValidCatchRecordState,
  isValidDraft,
  isValidHistory,
  isValidRecordDetail,
  isValidRecordList,
  isValidSubmissionList,
  recordPath,
  requireFavouriteId,
  requireFavourites,
  requireRecord,
  requireSkippers,
  skipperPayloadSchema,
  skippersPath,
  toBoom,
  trimTrailingSlashes,
  validateArtifact,
  validateLimit
} from './catch-recording-validation.js'

const DEFAULT_TIMEOUT_MS = 5000
const DEFAULT_LIST_LIMIT = 100
const SKIPPER_PROFILE = 'skipper'

function buildHeaders(
  { token, tracingHeader },
  { binary, payload, version, idempotencyKey, correlationId }
) {
  const headers = {
    Accept: binary
      ? `application/pdf, ${JSON_CONTENT_TYPE}`
      : JSON_CONTENT_TYPE,
    Authorization: `Bearer ${token}`
  }
  if (payload !== undefined) {
    headers['Content-Type'] = JSON_CONTENT_TYPE
  }
  if (version !== undefined) {
    headers['If-Match'] = String(version)
  }
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey
  }
  if (correlationId) {
    headers[tracingHeader] = correlationId
  }
  return headers
}

function send(config, path, options) {
  const init = {
    method: options.method,
    headers: buildHeaders(config, options),
    signal: AbortSignal.timeout(config.timeoutMs),
    redirect: 'error'
  }
  if (options.payload !== undefined) {
    init.body = JSON.stringify(options.payload)
  }
  return config.fetchFn(
    `${trimTrailingSlashes(config.serviceUrl)}${path}`,
    init
  )
}

async function readResponse(response, { method, binary, vesselProfile }) {
  if (!isSuccessStatus(response.status)) {
    throw errorFromStatus(response.status, vesselProfile)
  }
  const expectedStatus =
    method === 'DELETE' ? statusCodes.noContent : statusCodes.ok
  if (response.status !== expectedStatus) {
    throw Boom.badGateway(
      'Catch Recording Service returned an unexpected response'
    )
  }
  if (response.status === statusCodes.noContent) {
    return null
  }
  if (binary) {
    return { body: Buffer.from(await response.arrayBuffer()) }
  }
  return response.json()
}

function createTransport(config) {
  function assertConfigured() {
    if (!config.serviceUrl || !config.token) {
      throw Boom.serverUnavailable(NOT_CONFIGURED_MESSAGE)
    }
  }

  async function request(path, options = {}) {
    const requestOptions = {
      ...options,
      method: options.method ?? 'GET',
      binary: options.binary ?? false,
      vesselProfile: options.vesselProfile ?? ''
    }
    assertConfigured()
    if (
      !requestOptions.vesselProfile &&
      requestOptions.method !== 'GET' &&
      !isPositiveInteger(requestOptions.version)
    ) {
      throw Boom.badRequest('A valid catch record version is required')
    }
    try {
      const response = await send(config, path, requestOptions)
      return await readResponse(response, requestOptions)
    } catch (error) {
      throw toBoom(error, UNAVAILABLE_MESSAGE)
    }
  }

  async function fetchJson(
    path,
    { expectedStatus, failureMessage, ...options }
  ) {
    assertConfigured()
    try {
      const response = await send(config, path, options)
      if (response.status !== expectedStatus) {
        throw Boom.serverUnavailable(failureMessage)
      }
      return await response.json()
    } catch (error) {
      throw toBoom(error, failureMessage)
    }
  }

  return { request, fetchJson }
}

function favouriteOperations(request, { resource, label, idField, field }) {
  const listPath = (vesselId) => favouritesPath(vesselId, undefined, resource)
  return {
    async list({ vesselId, correlationId }) {
      return requireFavourites(
        await request(listPath(vesselId), {
          correlationId,
          vesselProfile: label
        }),
        vesselId,
        field
      )
    },
    async add({ vesselId, [idField]: id, correlationId }) {
      requireFavouriteId(id)
      const result = requireFavourites(
        await request(listPath(vesselId), {
          method: 'POST',
          payload: { [idField]: id },
          correlationId,
          vesselProfile: label
        }),
        vesselId,
        field
      )
      if (!result[field].includes(id)) {
        throw Boom.badGateway(
          `Catch Recording Service did not return the added favourite ${label}`
        )
      }
      return result
    },
    remove({ vesselId, [idField]: id, correlationId }) {
      requireFavouriteId(id)
      return request(favouritesPath(vesselId, id, resource), {
        method: 'DELETE',
        correlationId,
        vesselProfile: label
      })
    }
  }
}

function favouriteClientMethods(request) {
  const gears = favouriteOperations(request, {
    resource: 'gears',
    label: 'gear',
    idField: 'gearId',
    field: 'favouriteGearIds'
  })
  const species = favouriteOperations(request, {
    resource: 'species',
    label: 'species',
    idField: 'speciesId',
    field: 'favouriteSpeciesIds'
  })
  const ports = favouriteOperations(request, {
    resource: 'ports',
    label: 'port',
    idField: 'portId',
    field: 'favouritePortIds'
  })
  return {
    listFavouriteGears: gears.list,
    addFavouriteGear: gears.add,
    removeFavouriteGear: gears.remove,
    listFavouriteSpecies: species.list,
    addFavouriteSpecies: species.add,
    removeFavouriteSpecies: species.remove,
    listFavouritePorts: ports.list,
    addFavouritePort: ports.add,
    removeFavouritePort: ports.remove
  }
}

function skipperClientMethods(request) {
  return {
    async listSkippers({ vesselId, correlationId }) {
      return requireSkippers(
        await request(skippersPath(vesselId), {
          correlationId,
          vesselProfile: SKIPPER_PROFILE
        }),
        vesselId
      )
    },
    async addSkipper({ vesselId, skipper, idempotencyKey, correlationId }) {
      const { error, value } = skipperPayloadSchema.validate(skipper)
      if (error) {
        throw Boom.badRequest('Enter valid skipper details')
      }
      const result = requireSkippers(
        await request(skippersPath(vesselId), {
          method: 'POST',
          payload: value,
          idempotencyKey,
          correlationId,
          vesselProfile: SKIPPER_PROFILE
        }),
        vesselId
      )
      if (!hasSkipperNamed(result.skippers, value.name)) {
        throw Boom.badGateway(
          'Catch Recording Service did not return the added skipper'
        )
      }
      return result
    },
    removeSkipper({ vesselId, skipperId, correlationId }) {
      if (!isNonEmptyString(skipperId)) {
        throw Boom.badRequest('A skipper ID is required')
      }
      return request(skippersPath(vesselId, skipperId), {
        method: 'DELETE',
        correlationId,
        vesselProfile: SKIPPER_PROFILE
      })
    }
  }
}

function recordMutationMethods(request) {
  async function recordAction(catchRecordId, suffix, options, method) {
    return requireRecord(
      await request(`${recordPath(catchRecordId)}${suffix}`, {
        ...options,
        method
      }),
      catchRecordId
    )
  }

  return {
    saveSection({ catchRecordId, section, data, ...options }) {
      return recordAction(
        catchRecordId,
        '',
        { ...options, payload: { section, data } },
        'PATCH'
      )
    },
    replaceRecord({ catchRecordId, payload, ...options }) {
      return recordAction(catchRecordId, '', { ...options, payload }, 'PUT')
    },
    deleteRecord({ catchRecordId, ...options }) {
      return request(recordPath(catchRecordId), {
        ...options,
        method: 'DELETE'
      })
    },
    submitRecord({ catchRecordId, ...options }) {
      return recordAction(catchRecordId, '/submission', options, 'POST')
    },
    completeRecord({ catchRecordId, ...options }) {
      return recordAction(catchRecordId, '/completion', options, 'POST')
    },
    startEdit({ catchRecordId, ...options }) {
      return recordAction(catchRecordId, '/edit-start', options, 'POST')
    }
  }
}

function recordQueryMethods(request) {
  return {
    async listRecords({
      limit = DEFAULT_LIST_LIMIT,
      status,
      correlationId
    } = {}) {
      validateLimit(limit)
      if (status && !RECORD_STATUSES.includes(status)) {
        throw Boom.badRequest('Invalid catch record status')
      }
      const query = new URLSearchParams({ limit: String(limit) })
      if (status) {
        query.set('status', status)
      }
      const body = await request(`/v1/catch-records?${query}`, {
        correlationId
      })
      if (!isValidRecordList(body)) {
        throw Boom.badGateway(
          'Catch Recording Service returned an invalid record list'
        )
      }
      return body
    },
    async getRecord({ catchRecordId, correlationId }) {
      const body = requireRecord(
        await request(recordPath(catchRecordId), { correlationId }),
        catchRecordId
      )
      if (!isValidRecordDetail(body)) {
        throw Boom.badGateway(INVALID_RECORD_MESSAGE)
      }
      return body
    }
  }
}

function submissionMethods(request) {
  return {
    async getHistory({
      catchRecordId,
      limit = DEFAULT_LIST_LIMIT,
      correlationId
    }) {
      validateLimit(limit)
      const body = await request(
        `${recordPath(catchRecordId)}/history?limit=${limit}`,
        { correlationId }
      )
      if (!isValidHistory(body, catchRecordId)) {
        throw Boom.badGateway(
          'Catch Recording Service returned invalid history'
        )
      }
      return body
    },
    async listSubmissions({ catchRecordId, correlationId }) {
      const body = await request(`${recordPath(catchRecordId)}/submissions`, {
        correlationId
      })
      if (!isValidSubmissionList(body, catchRecordId)) {
        throw Boom.badGateway(
          'Catch Recording Service returned invalid submissions'
        )
      }
      return body
    },
    downloadArtifact({
      catchRecordId,
      submissionNumber,
      artifactType,
      correlationId
    }) {
      validateArtifact(submissionNumber, artifactType)
      return request(
        `${recordPath(catchRecordId)}/submissions/${submissionNumber}/${artifactType}`,
        { correlationId, binary: true }
      )
    }
  }
}

function draftMethods(fetchJson) {
  return {
    async getCatchRecord({ catchRecordId, correlationId }) {
      const body = await fetchJson(
        `/v1/catch-records/${encodeURIComponent(catchRecordId)}`,
        {
          method: 'GET',
          correlationId,
          expectedStatus: statusCodes.ok,
          failureMessage: 'Catch record could not be retrieved'
        }
      )
      if (!isValidCatchRecordState(body, catchRecordId)) {
        throw Boom.badGateway(INVALID_RECORD_MESSAGE)
      }
      return catchRecordState(body)
    },
    async createDraft({ vesselId, idempotencyKey, correlationId }) {
      const body = await fetchJson('/v1/catch-records', {
        method: 'POST',
        payload: { vesselId },
        idempotencyKey,
        correlationId,
        expectedStatus: statusCodes.created,
        failureMessage: 'Catch record could not be created'
      })
      if (!isValidDraft(body)) {
        throw Boom.badGateway(
          'Catch Recording Service returned an invalid draft'
        )
      }
      return {
        id: body.id,
        catchRecordReference: body.catchRecordReference,
        version: body.version
      }
    }
  }
}

export function createCatchRecordingClient({
  serviceUrl,
  token,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  tracingHeader = 'x-cdp-request-id',
  fetchFn = (...args) => globalThis.fetch(...args)
}) {
  const { request, fetchJson } = createTransport({
    serviceUrl,
    token,
    timeoutMs,
    tracingHeader,
    fetchFn
  })
  return {
    ...favouriteClientMethods(request),
    ...skipperClientMethods(request),
    ...recordQueryMethods(request),
    ...recordMutationMethods(request),
    ...submissionMethods(request),
    ...draftMethods(fetchJson)
  }
}
