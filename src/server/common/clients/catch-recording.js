import Boom from '@hapi/boom'
import Joi from 'joi'

const skipperPayloadSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  phoneNumber: Joi.string().trim().min(1).max(30),
  email: Joi.string().trim().email().max(254)
}).required()

export function createCatchRecordingClient({
  serviceUrl,
  token,
  timeoutMs = 5000,
  tracingHeader = 'x-cdp-request-id',
  fetchFn = (...args) => globalThis.fetch(...args)
}) {
  function recordPath(id) {
    if (typeof id !== 'string' || !id.trim() || id.length > 200) {
      throw Boom.badRequest('A catch record ID is required')
    }
    return `/v1/catch-records/${encodeURIComponent(id)}`
  }
  function validateLimit(limit) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw Boom.badRequest('Limit must be between 1 and 100')
    }
  }
  function favouritesPath(vesselId, itemId, resource) {
    for (const id of itemId === undefined ? [vesselId] : [vesselId, itemId]) {
      if (typeof id !== 'string' || !id.trim() || id.length > 200) {
        throw Boom.badRequest('A valid vessel and favourite ID are required')
      }
    }
    const path = `/v1/vessels/${encodeURIComponent(vesselId)}/favourite-${resource}`
    return itemId === undefined ? path : `${path}/${encodeURIComponent(itemId)}`
  }
  function requireFavouriteId(id) {
    if (typeof id !== 'string' || !id.trim() || id.length > 200) {
      throw Boom.badRequest('A valid favourite ID is required')
    }
  }
  function requireFavourites(body, vesselId, field) {
    if (
      body?.vesselId !== vesselId ||
      !Array.isArray(body[field]) ||
      !body[field].every(
        (id) => typeof id === 'string' && id.trim().length > 0
      ) ||
      new Set(body[field]).size !== body[field].length
    ) {
      throw Boom.badGateway(
        'Catch Recording Service returned invalid vessel favourites'
      )
    }
    return body
  }
  function skippersPath(vesselId, skipperId) {
    for (const id of skipperId === undefined
      ? [vesselId]
      : [vesselId, skipperId]) {
      if (typeof id !== 'string' || !id.trim() || id.length > 200) {
        throw Boom.badRequest('A valid vessel and skipper ID are required')
      }
    }
    const path = `/v1/vessels/${encodeURIComponent(vesselId)}/skippers`
    return skipperId === undefined
      ? path
      : `${path}/${encodeURIComponent(skipperId)}`
  }
  function requireSkippers(body, vesselId) {
    if (
      body?.vesselId !== vesselId ||
      !Array.isArray(body.skippers) ||
      !body.skippers.every(
        (skipper) =>
          typeof skipper?.id === 'string' &&
          skipper.id.trim().length > 0 &&
          typeof skipper.name === 'string' &&
          skipper.name.trim().length > 0 &&
          (skipper.phoneNumber == null ||
            typeof skipper.phoneNumber === 'string') &&
          (skipper.email == null || typeof skipper.email === 'string')
      ) ||
      new Set(body.skippers.map((skipper) => skipper.id)).size !==
        body.skippers.length
    ) {
      throw Boom.badGateway(
        'Catch Recording Service returned invalid vessel skippers'
      )
    }
    return body
  }
  async function request(
    path,
    {
      method = 'GET',
      version,
      idempotencyKey,
      payload,
      correlationId,
      binary = false,
      vesselProfile = false
    } = {}
  ) {
    if (!serviceUrl || !token) {
      throw Boom.serverUnavailable('Catch Recording Service is not configured')
    }
    if (
      !vesselProfile &&
      method !== 'GET' &&
      (!Number.isSafeInteger(version) || version < 1)
    ) {
      throw Boom.badRequest('A valid catch record version is required')
    }
    try {
      const response = await fetchFn(
        `${serviceUrl.replace(/\/+$/, '')}${path}`,
        {
          method,
          headers: {
            Accept: binary
              ? 'application/pdf, application/json'
              : 'application/json',
            Authorization: `Bearer ${token}`,
            ...(payload !== undefined
              ? { 'Content-Type': 'application/json' }
              : {}),
            ...(version !== undefined ? { 'If-Match': String(version) } : {}),
            ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
            ...(correlationId ? { [tracingHeader]: correlationId } : {})
          },
          ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
          signal: AbortSignal.timeout(timeoutMs),
          redirect: 'error'
        }
      )
      if (response.status < 200 || response.status >= 300) {
        const messages = {
          400: 'The catch record could not be saved. Check your answers.',
          401: 'Catch Recording authentication failed.',
          403: 'You do not have permission to access this catch record.',
          404: 'The catch record could not be found.',
          409: 'The record has changed or a request is still in progress. Reload it before trying again.',
          412: 'The record has changed. Reload it before trying again.',
          422: 'The catch record is not ready. Check your answers.'
        }
        if (vesselProfile) {
          const label = vesselProfile
          const plural = label === 'species' ? label : `${label}s`
          Object.assign(messages, {
            400: `The vessel favourite ${plural} could not be updated. Check your selection.`,
            403: 'You do not have permission to access this vessel.',
            404: `The vessel or favourite ${label} could not be found.`,
            409: `The favourite ${label} request is still in progress. Reload the page before trying again.`,
            422: `The selected ${label} cannot be added to the vessel favourites.`
          })
          if (vesselProfile === 'skipper') {
            Object.assign(messages, {
              400: 'The skipper could not be saved. Check the skipper details.',
              404: 'The vessel or skipper could not be found.',
              409: 'The skipper request conflicts with an existing entry or is still in progress. Reload the page before trying again.',
              422: 'The skipper could not be added. Check the skipper details.'
            })
          }
        }
        const status = Object.hasOwn(messages, response.status)
          ? response.status
          : 503
        throw Boom.boomify(
          new Error(
            messages[status] ||
              'Catch Recording Service is temporarily unavailable'
          ),
          { statusCode: status, data: { catchRecordError: true } }
        )
      }
      if (response.status !== (method === 'DELETE' ? 204 : 200)) {
        throw Boom.badGateway(
          'Catch Recording Service returned an unexpected response'
        )
      }
      if (response.status === 204) {
        return null
      }
      if (binary) {
        return { body: Buffer.from(await response.arrayBuffer()) }
      }
      return await response.json()
    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.serverUnavailable(
        'Catch Recording Service is temporarily unavailable'
      )
    }
  }
  function requireRecord(body, id) {
    if (
      body?.id !== id ||
      !Number.isSafeInteger(body.version) ||
      body.version < 1 ||
      typeof body.catchRecordReference !== 'string' ||
      !body.catchRecordReference ||
      !['DRAFT', 'SUBMITTED', 'COMPLETE'].includes(body.status)
    ) {
      throw Boom.badGateway(
        'Catch Recording Service returned an invalid record'
      )
    }
    return body
  }

  function favouriteOperations(resource, label, idField, field) {
    return {
      async list({ vesselId, correlationId }) {
        return requireFavourites(
          await request(favouritesPath(vesselId, undefined, resource), {
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
          await request(favouritesPath(vesselId, undefined, resource), {
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
  const gearFavourites = favouriteOperations(
    'gears',
    'gear',
    'gearId',
    'favouriteGearIds'
  )
  const speciesFavourites = favouriteOperations(
    'species',
    'species',
    'speciesId',
    'favouriteSpeciesIds'
  )
  const portFavourites = favouriteOperations(
    'ports',
    'port',
    'portId',
    'favouritePortIds'
  )

  return {
    listFavouriteGears: gearFavourites.list,
    async listSkippers({ vesselId, correlationId }) {
      return requireSkippers(
        await request(skippersPath(vesselId), {
          correlationId,
          vesselProfile: 'skipper'
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
          vesselProfile: 'skipper'
        }),
        vesselId
      )
      if (
        !result.skippers.some(
          (item) => item.name.trim().toLowerCase() === value.name.toLowerCase()
        )
      ) {
        throw Boom.badGateway(
          'Catch Recording Service did not return the added skipper'
        )
      }
      return result
    },
    removeSkipper({ vesselId, skipperId, correlationId }) {
      if (typeof skipperId !== 'string' || !skipperId.trim()) {
        throw Boom.badRequest('A skipper ID is required')
      }
      return request(skippersPath(vesselId, skipperId), {
        method: 'DELETE',
        correlationId,
        vesselProfile: 'skipper'
      })
    },
    addFavouriteGear: gearFavourites.add,
    removeFavouriteGear: gearFavourites.remove,
    listFavouriteSpecies: speciesFavourites.list,
    addFavouriteSpecies: speciesFavourites.add,
    removeFavouriteSpecies: speciesFavourites.remove,
    listFavouritePorts: portFavourites.list,
    addFavouritePort: portFavourites.add,
    removeFavouritePort: portFavourites.remove,
    async listRecords({ limit = 100, status, correlationId } = {}) {
      validateLimit(limit)
      if (status && !['DRAFT', 'SUBMITTED', 'COMPLETE'].includes(status)) {
        throw Boom.badRequest('Invalid catch record status')
      }
      const query = new URLSearchParams({ limit: String(limit) })
      if (status) query.set('status', status)
      const body = await request(`/v1/catch-records?${query}`, {
        correlationId
      })
      if (
        !Array.isArray(body?.items) ||
        body.count !== body.items.length ||
        !body.items.every(
          (item) =>
            typeof item?.id === 'string' &&
            typeof item.catchRecordReference === 'string' &&
            item.trip &&
            typeof item.trip === 'object' &&
            typeof item.vessel?.nameSnapshot === 'string' &&
            ['Draft', 'Amended', 'Submitted', 'Complete', 'Late'].includes(
              item.displayStatus
            )
        )
      ) {
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
      if (
        typeof body.vessel?.id !== 'string' ||
        typeof body.vessel.nameSnapshot !== 'string' ||
        !body.trip ||
        !body.pairFishing ||
        !Array.isArray(body.gears) ||
        !body.gears.every(
          (entry) =>
            typeof entry?.associationId === 'string' &&
            typeof entry.gear?.id === 'string' &&
            typeof entry.gear.nameSnapshot === 'string' &&
            Array.isArray(entry.characteristics) &&
            entry.characteristics.every(
              (item) => typeof item?.characteristicId === 'string'
            ) &&
            Array.isArray(entry.speciesCaught) &&
            entry.speciesCaught.every((item) => typeof item?.id === 'string')
        ) ||
        !Array.isArray(body.speciesNotLanded) ||
        !body.speciesNotLanded.every((item) => typeof item?.id === 'string') ||
        !['trip', 'pairFishing', 'gears'].every(
          (section) => typeof body.sectionCompletion?.[section] === 'boolean'
        ) ||
        !Array.isArray(body.completedSections) ||
        !Array.isArray(body.incompleteSections) ||
        typeof body.submissionEligible !== 'boolean' ||
        !Number.isSafeInteger(body.numberOfSubmissions) ||
        body.numberOfSubmissions < 0 ||
        !['Draft', 'Amended', 'Submitted', 'Complete'].includes(
          body.displayStatus
        )
      ) {
        throw Boom.badGateway(
          'Catch Recording Service returned an invalid record'
        )
      }
      return body
    },
    async saveSection({ catchRecordId, section, data, ...options }) {
      return requireRecord(
        await request(recordPath(catchRecordId), {
          ...options,
          method: 'PATCH',
          payload: { section, data }
        }),
        catchRecordId
      )
    },
    async replaceRecord({ catchRecordId, payload, ...options }) {
      return requireRecord(
        await request(recordPath(catchRecordId), {
          ...options,
          method: 'PUT',
          payload
        }),
        catchRecordId
      )
    },
    deleteRecord({ catchRecordId, ...options }) {
      return request(recordPath(catchRecordId), {
        ...options,
        method: 'DELETE'
      })
    },
    async submitRecord({ catchRecordId, ...options }) {
      return requireRecord(
        await request(`${recordPath(catchRecordId)}/submission`, {
          ...options,
          method: 'POST'
        }),
        catchRecordId
      )
    },
    async completeRecord({ catchRecordId, ...options }) {
      return requireRecord(
        await request(`${recordPath(catchRecordId)}/completion`, {
          ...options,
          method: 'POST'
        }),
        catchRecordId
      )
    },
    async startEdit({ catchRecordId, ...options }) {
      return requireRecord(
        await request(`${recordPath(catchRecordId)}/edit-start`, {
          ...options,
          method: 'POST'
        }),
        catchRecordId
      )
    },
    async getHistory({ catchRecordId, limit = 100, correlationId }) {
      validateLimit(limit)
      const body = await request(
        `${recordPath(catchRecordId)}/history?limit=${limit}`,
        { correlationId }
      )
      if (
        body?.catchRecordId !== catchRecordId ||
        !Array.isArray(body.events) ||
        !body.events.every(
          (event) =>
            typeof event?.eventType === 'string' &&
            typeof event.timestamp === 'string'
        )
      ) {
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
      if (
        body?.catchRecordId !== catchRecordId ||
        !Array.isArray(body.submissions) ||
        body.count !== body.submissions.length ||
        !body.submissions.every(
          (item) =>
            Number.isSafeInteger(item?.submissionNumber) &&
            item.submissionNumber > 0 &&
            Array.isArray(item.artifacts) &&
            item.artifacts.every((artifact) =>
              ['json', 'pdf'].includes(artifact?.type)
            )
        )
      ) {
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
      if (
        !['json', 'pdf'].includes(artifactType) ||
        !Number.isSafeInteger(submissionNumber) ||
        submissionNumber < 1 ||
        submissionNumber > 1000
      ) {
        throw Boom.badRequest('Invalid artifact')
      }
      return request(
        `${recordPath(catchRecordId)}/submissions/${submissionNumber}/${artifactType}`,
        {
          correlationId,
          binary: true
        }
      )
    },
    async getCatchRecord({ catchRecordId, correlationId }) {
      if (!serviceUrl || !token) {
        throw Boom.serverUnavailable(
          'Catch Recording Service is not configured'
        )
      }

      let body
      try {
        const response = await fetchFn(
          `${serviceUrl.replace(/\/+$/, '')}/v1/catch-records/${encodeURIComponent(catchRecordId)}`,
          {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${token}`,
              ...(correlationId ? { [tracingHeader]: correlationId } : {})
            },
            signal: AbortSignal.timeout(timeoutMs),
            redirect: 'error'
          }
        )
        if (response.status !== 200) {
          throw Boom.serverUnavailable('Catch record could not be retrieved')
        }
        body = await response.json()
      } catch (error) {
        if (Boom.isBoom(error)) {
          throw error
        }
        throw Boom.serverUnavailable('Catch record could not be retrieved')
      }

      const validSections = ['trip', 'pairFishing', 'gears']
      const validDisplayStatuses = ['Draft', 'Amended', 'Submitted', 'Complete']
      if (
        body?.id !== catchRecordId ||
        !['DRAFT', 'SUBMITTED', 'COMPLETE'].includes(body.status) ||
        !validDisplayStatuses.includes(body.displayStatus) ||
        !Number.isSafeInteger(body.version) ||
        body.version < 1 ||
        !validSections.every(
          (section) => typeof body.sectionCompletion?.[section] === 'boolean'
        ) ||
        !Array.isArray(body.completedSections) ||
        !body.completedSections.every((section) =>
          validSections.includes(section)
        ) ||
        !Array.isArray(body.incompleteSections) ||
        !body.incompleteSections.every((section) =>
          validSections.includes(section)
        ) ||
        typeof body.progress?.hasUnsubmittedChanges !== 'boolean' ||
        !Number.isSafeInteger(body.progress?.numberOfSubmissions) ||
        body.progress.numberOfSubmissions < 0 ||
        !Array.isArray(body.progress?.incompleteGearAssociationIds) ||
        !body.progress.incompleteGearAssociationIds.every(
          (id) => typeof id === 'string'
        ) ||
        !(
          body.progress.currentIncompleteGearAssociationId === null ||
          typeof body.progress.currentIncompleteGearAssociationId === 'string'
        ) ||
        typeof body.progress.allGearsComplete !== 'boolean' ||
        typeof body.submissionEligible !== 'boolean'
      ) {
        throw Boom.badGateway(
          'Catch Recording Service returned an invalid record'
        )
      }

      return {
        id: body.id,
        status: body.status,
        displayStatus: body.displayStatus,
        version: body.version,
        completedSections: body.completedSections,
        incompleteSections: body.incompleteSections,
        progress: {
          hasUnsubmittedChanges: body.progress.hasUnsubmittedChanges,
          numberOfSubmissions: body.progress.numberOfSubmissions,
          incompleteGearAssociationIds:
            body.progress.incompleteGearAssociationIds,
          allGearsComplete: body.progress.allGearsComplete
        },
        submissionEligible: body.submissionEligible
      }
    },

    async createDraft({ vesselId, idempotencyKey, correlationId }) {
      if (!serviceUrl || !token) {
        throw Boom.serverUnavailable(
          'Catch Recording Service is not configured'
        )
      }

      try {
        const response = await fetchFn(
          `${serviceUrl.replace(/\/+$/, '')}/v1/catch-records`,
          {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
              'Idempotency-Key': idempotencyKey,
              ...(correlationId ? { [tracingHeader]: correlationId } : {})
            },
            body: JSON.stringify({ vesselId }),
            signal: AbortSignal.timeout(timeoutMs),
            redirect: 'error'
          }
        )
        if (response.status !== 201) {
          throw Boom.serverUnavailable('Catch record could not be created')
        }

        const body = await response.json()
        if (
          typeof body?.id !== 'string' ||
          !body.id.trim() ||
          typeof body.catchRecordReference !== 'string' ||
          !body.catchRecordReference.trim() ||
          !Number.isSafeInteger(body.version) ||
          body.version < 1 ||
          body.status !== 'DRAFT'
        ) {
          throw Boom.badGateway(
            'Catch Recording Service returned an invalid draft'
          )
        }
        return {
          id: body.id,
          catchRecordReference: body.catchRecordReference,
          version: body.version
        }
      } catch (error) {
        if (Boom.isBoom(error)) {
          throw error
        }
        throw Boom.serverUnavailable('Catch record could not be created')
      }
    }
  }
}
