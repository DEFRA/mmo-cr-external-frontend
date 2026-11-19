// Status display mapping only (label + govukTag colour) — routing lives in journey/records.js.
import { t } from '#/server/common/helpers/i18n/translator.js'

const STATUS_KEYS = {
  submitted: 'records.status.submitted',
  amended: 'records.status.amended',
  draft: 'records.status.draft',
  unsent: 'records.status.unsent',
  late: 'records.status.late',
  complete: 'records.status.complete',
  unknown: 'records.status.unknown'
}

const DISPLAY_STATUS_KEYS = {
  Amended: STATUS_KEYS.amended,
  Complete: STATUS_KEYS.complete,
  Draft: STATUS_KEYS.draft,
  Late: STATUS_KEYS.late,
  Submitted: STATUS_KEYS.submitted,
  Unsent: STATUS_KEYS.unsent,
  Unknown: STATUS_KEYS.unknown
}

const STATUS_DISPLAY = {
  submitted: {
    text: () => t(STATUS_KEYS.submitted),
    tagClasses: 'govuk-tag--green'
  },
  amended: {
    text: () => t(STATUS_KEYS.amended),
    tagClasses: 'govuk-tag--blue'
  },
  draft: {
    text: () => t(STATUS_KEYS.draft),
    tagClasses: 'govuk-tag--yellow'
  },
  unsent: {
    text: () => t(STATUS_KEYS.unsent),
    tagClasses: 'govuk-tag--yellow'
  },
  late: {
    text: () => t(STATUS_KEYS.late),
    tagClasses: 'govuk-tag--pink'
  },
  complete: {
    text: () => t(STATUS_KEYS.complete),
    tagClasses: 'govuk-tag--grey'
  }
}

const UNKNOWN_STATUS_DISPLAY = {
  text: () => t(STATUS_KEYS.unknown),
  tagClasses: 'govuk-tag--grey'
}

/**
 * Resolves the govukTag text/colour for a record status. Falls back to a
 * neutral, safe display for any unrecognised status.
 */
export function getStatusDisplay(status) {
  const display = STATUS_DISPLAY[status] ?? UNKNOWN_STATUS_DISPLAY
  return { ...display, text: display.text() }
}

export function getRecordDisplayStatus(record) {
  if (record.status === 'DRAFT') {
    return t(STATUS_KEYS.draft)
  }
  if (record.status === 'SUBMITTED' && record.displayStatus !== 'Late') {
    return record.numberOfSubmissions > 1
      ? t(STATUS_KEYS.amended)
      : t(STATUS_KEYS.submitted)
  }
  const statusKey = DISPLAY_STATUS_KEYS[record.displayStatus]

  return statusKey ? t(statusKey) : record.displayStatus
}
