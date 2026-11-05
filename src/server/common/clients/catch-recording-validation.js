import Boom from '@hapi/boom'
import Joi from 'joi'

import { statusCodes } from '#/server/common/constants/status-codes.js'

const SKIPPER_NAME_MAX_LENGTH = 100
const SKIPPER_PHONE_MAX_LENGTH = 30
const SKIPPER_EMAIL_MAX_LENGTH = 254

export const skipperPayloadSchema = Joi.object({
  name: Joi.string().trim().min(1).max(SKIPPER_NAME_MAX_LENGTH).required(),
  phoneNumber: Joi.string().trim().min(1).max(SKIPPER_PHONE_MAX_LENGTH),
  email: Joi.string().trim().email().max(SKIPPER_EMAIL_MAX_LENGTH)
}).required()

export const JSON_CONTENT_TYPE = 'application/json'
export const NOT_CONFIGURED_MESSAGE =
  'Catch Recording Service is not configured'
export const UNAVAILABLE_MESSAGE =
  'Catch Recording Service is temporarily unavailable'
export const INVALID_RECORD_MESSAGE =
  'Catch Recording Service returned an invalid record'
export const RECORD_STATUSES = ['DRAFT', 'SUBMITTED', 'COMPLETE']
const RECORD_DISPLAY_STATUSES = ['Draft', 'Amended', 'Submitted', 'Complete']
const LIST_DISPLAY_STATUSES = [...RECORD_DISPLAY_STATUSES, 'Late']
const RECORD_SECTIONS = ['trip', 'pairFishing', 'gears']
const ARTIFACT_TYPES = ['json', 'pdf']
const MAX_ID_LENGTH = 200
const MAX_LIST_LIMIT = 100
const MAX_SUBMISSION_NUMBER = 1000

const DEFAULT_ERROR_MESSAGES = {
  400: 'The catch record could not be saved. Check your answers.',
  401: 'Catch Recording authentication failed.',
  403: 'You do not have permission to access this catch record.',
  404: 'The catch record could not be found.',
  409: 'The record has changed or a request is still in progress. Reload it before trying again.',
  412: 'The record has changed. Reload it before trying again.',
  422: 'The catch record is not ready. Check your answers.'
}

const SKIPPER_ERROR_MESSAGES = {
  400: 'The skipper could not be saved. Check the skipper details.',
  404: 'The vessel or skipper could not be found.',
  409: 'The skipper request conflicts with an existing entry or is still in progress. Reload the page before trying again.',
  422: 'The skipper could not be added. Check the skipper details.'
}

function isString(value) {
  return typeof value === 'string'
}

export function isNonEmptyString(value) {
  return isString(value) && value.trim().length > 0
}

function isValidId(id) {
  return isNonEmptyString(id) && id.length <= MAX_ID_LENGTH
}

function isOptionalString(value) {
  return value == null || isString(value)
}

function isNullableString(value) {
  return value === null || isString(value)
}

function isBoolean(value) {
  return typeof value === 'boolean'
}

export function isPositiveInteger(value) {
  return Number.isSafeInteger(value) && value >= 1
}

function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0
}

export function isArrayOf(value, predicate) {
  return Array.isArray(value) && value.every(predicate)
}

function hasUniqueValues(values) {
  return new Set(values).size === values.length
}

function hasStringId(item) {
  return isString(item?.id)
}

function isRecordSection(section) {
  return RECORD_SECTIONS.includes(section)
}

function isValidSkipper(skipper) {
  return (
    isNonEmptyString(skipper?.id) &&
    isNonEmptyString(skipper.name) &&
    isOptionalString(skipper.phoneNumber) &&
    isOptionalString(skipper.email)
  )
}

export function isValidListItem(item) {
  return (
    isString(item?.id) &&
    isString(item.catchRecordReference) &&
    Boolean(item.trip) &&
    typeof item.trip === 'object' &&
    isString(item.vessel?.nameSnapshot) &&
    LIST_DISPLAY_STATUSES.includes(item.displayStatus)
  )
}

function isValidGearEntry(entry) {
  return (
    isString(entry?.associationId) &&
    isString(entry.gear?.id) &&
    isString(entry.gear.nameSnapshot) &&
    isArrayOf(entry.characteristics, (item) =>
      isString(item?.characteristicId)
    ) &&
    isArrayOf(entry.speciesCaught, hasStringId)
  )
}

function hasSectionCompletion(body) {
  return RECORD_SECTIONS.every((section) =>
    isBoolean(body.sectionCompletion?.[section])
  )
}

function hasRecordContext(body) {
  return (
    isString(body.vessel?.id) &&
    isString(body.vessel.nameSnapshot) &&
    Boolean(body.trip) &&
    Boolean(body.pairFishing)
  )
}

function hasRecordSectionState(body) {
  return (
    hasSectionCompletion(body) &&
    Array.isArray(body.completedSections) &&
    Array.isArray(body.incompleteSections) &&
    isBoolean(body.submissionEligible)
  )
}

export function isValidRecordDetail(body) {
  return (
    hasRecordContext(body) &&
    isArrayOf(body.gears, isValidGearEntry) &&
    isArrayOf(body.speciesNotLanded, hasStringId) &&
    hasRecordSectionState(body) &&
    isNonNegativeInteger(body.numberOfSubmissions) &&
    RECORD_DISPLAY_STATUSES.includes(body.displayStatus)
  )
}

function hasValidRecordStatus(body) {
  return (
    RECORD_STATUSES.includes(body.status) &&
    RECORD_DISPLAY_STATUSES.includes(body.displayStatus) &&
    isPositiveInteger(body.version)
  )
}

function hasValidSectionLists(body) {
  return (
    hasSectionCompletion(body) &&
    isArrayOf(body.completedSections, isRecordSection) &&
    isArrayOf(body.incompleteSections, isRecordSection)
  )
}

function isValidProgress(progress) {
  return (
    isBoolean(progress?.hasUnsubmittedChanges) &&
    isNonNegativeInteger(progress.numberOfSubmissions) &&
    isArrayOf(progress.incompleteGearAssociationIds, isString) &&
    isNullableString(progress.currentIncompleteGearAssociationId) &&
    isBoolean(progress.allGearsComplete)
  )
}

export function isValidCatchRecordState(body, catchRecordId) {
  return (
    body?.id === catchRecordId &&
    hasValidRecordStatus(body) &&
    hasValidSectionLists(body) &&
    isValidProgress(body.progress) &&
    isBoolean(body.submissionEligible)
  )
}

export function isValidDraft(body) {
  return (
    isNonEmptyString(body?.id) &&
    isNonEmptyString(body.catchRecordReference) &&
    isPositiveInteger(body.version) &&
    body.status === 'DRAFT'
  )
}

export function isValidSubmission(item) {
  return (
    isPositiveInteger(item?.submissionNumber) &&
    isArrayOf(item.artifacts, (artifact) =>
      ARTIFACT_TYPES.includes(artifact?.type)
    )
  )
}

export function isValidHistoryEvent(event) {
  return isString(event?.eventType) && isString(event.timestamp)
}

function vesselFavouriteErrorMessages(label) {
  const plural = label === 'species' ? label : `${label}s`
  return {
    400: `The vessel favourite ${plural} could not be updated. Check your selection.`,
    403: 'You do not have permission to access this vessel.',
    404: `The vessel or favourite ${label} could not be found.`,
    409: `The favourite ${label} request is still in progress. Reload the page before trying again.`,
    422: `The selected ${label} cannot be added to the vessel favourites.`
  }
}

function errorMessagesFor(vesselProfile) {
  if (!vesselProfile) {
    return DEFAULT_ERROR_MESSAGES
  }
  const skipperMessages =
    vesselProfile === 'skipper' ? SKIPPER_ERROR_MESSAGES : {}
  return {
    ...DEFAULT_ERROR_MESSAGES,
    ...vesselFavouriteErrorMessages(vesselProfile),
    ...skipperMessages
  }
}

export function errorFromStatus(responseStatus, vesselProfile) {
  const messages = errorMessagesFor(vesselProfile)
  const status = Object.hasOwn(messages, responseStatus)
    ? responseStatus
    : statusCodes.serviceUnavailable
  return Boom.boomify(new Error(messages[status] || UNAVAILABLE_MESSAGE), {
    statusCode: status,
    data: { catchRecordError: true }
  })
}

export function isSuccessStatus(status) {
  return status >= statusCodes.ok && status < statusCodes.multipleChoices
}

export function toBoom(error, message) {
  return Boom.isBoom(error) ? error : Boom.serverUnavailable(message)
}

export function trimTrailingSlashes(url) {
  let end = url.length
  while (end > 0 && url[end - 1] === '/') {
    end--
  }
  return url.slice(0, end)
}

export function requireRecord(body, id) {
  if (
    body?.id !== id ||
    !isPositiveInteger(body.version) ||
    !isString(body.catchRecordReference) ||
    !body.catchRecordReference ||
    !RECORD_STATUSES.includes(body.status)
  ) {
    throw Boom.badGateway(INVALID_RECORD_MESSAGE)
  }
  return body
}

export function requireFavourites(body, vesselId, field) {
  if (
    body?.vesselId !== vesselId ||
    !isArrayOf(body[field], isNonEmptyString) ||
    !hasUniqueValues(body[field])
  ) {
    throw Boom.badGateway(
      'Catch Recording Service returned invalid vessel favourites'
    )
  }
  return body
}

export function requireSkippers(body, vesselId) {
  if (
    body?.vesselId !== vesselId ||
    !isArrayOf(body.skippers, isValidSkipper) ||
    !hasUniqueValues(body.skippers.map((skipper) => skipper.id))
  ) {
    throw Boom.badGateway(
      'Catch Recording Service returned invalid vessel skippers'
    )
  }
  return body
}

export function recordPath(id) {
  if (!isValidId(id)) {
    throw Boom.badRequest('A catch record ID is required')
  }
  return `/v1/catch-records/${encodeURIComponent(id)}`
}

export function validateLimit(limit) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIST_LIMIT) {
    throw Boom.badRequest(`Limit must be between 1 and ${MAX_LIST_LIMIT}`)
  }
}

function vesselResourcePath(vesselId, itemId, resource, errorMessage) {
  const ids = itemId === undefined ? [vesselId] : [vesselId, itemId]
  if (!ids.every(isValidId)) {
    throw Boom.badRequest(errorMessage)
  }
  const path = `/v1/vessels/${encodeURIComponent(vesselId)}/${resource}`
  return itemId === undefined ? path : `${path}/${encodeURIComponent(itemId)}`
}

export function favouritesPath(vesselId, itemId, resource) {
  return vesselResourcePath(
    vesselId,
    itemId,
    `favourite-${resource}`,
    'A valid vessel and favourite ID are required'
  )
}

export function skippersPath(vesselId, skipperId) {
  return vesselResourcePath(
    vesselId,
    skipperId,
    'skippers',
    'A valid vessel and skipper ID are required'
  )
}

export function requireFavouriteId(id) {
  if (!isValidId(id)) {
    throw Boom.badRequest('A valid favourite ID is required')
  }
}

export function validateArtifact(submissionNumber, artifactType) {
  if (
    !ARTIFACT_TYPES.includes(artifactType) ||
    !Number.isSafeInteger(submissionNumber) ||
    submissionNumber < 1 ||
    submissionNumber > MAX_SUBMISSION_NUMBER
  ) {
    throw Boom.badRequest('Invalid artifact')
  }
}

export function hasSkipperNamed(skippers, name) {
  return skippers.some(
    (skipper) => skipper.name.trim().toLowerCase() === name.toLowerCase()
  )
}

export function isValidRecordList(body) {
  return (
    isArrayOf(body?.items, isValidListItem) && body.count === body.items.length
  )
}

export function isValidHistory(body, catchRecordId) {
  return (
    body?.catchRecordId === catchRecordId &&
    isArrayOf(body.events, isValidHistoryEvent)
  )
}

export function isValidSubmissionList(body, catchRecordId) {
  return (
    body?.catchRecordId === catchRecordId &&
    isArrayOf(body.submissions, isValidSubmission) &&
    body.count === body.submissions.length
  )
}

export function catchRecordState(body) {
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
      incompleteGearAssociationIds: body.progress.incompleteGearAssociationIds,
      allGearsComplete: body.progress.allGearsComplete
    },
    submissionEligible: body.submissionEligible
  }
}
