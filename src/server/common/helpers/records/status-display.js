// Status display mapping only (label + govukTag colour) — routing lives in journey/records.js.
import { t } from '#/server/common/helpers/i18n/translator.js'

const STATUS_DISPLAY = {
  submitted: {
    text: () => t('records.status.submitted'),
    tagClasses: 'govuk-tag--green'
  },
  amended: {
    text: () => t('records.status.amended'),
    tagClasses: 'govuk-tag--blue'
  },
  draft: {
    text: () => t('records.status.draft'),
    tagClasses: 'govuk-tag--yellow'
  },
  unsent: {
    text: () => t('records.status.unsent'),
    tagClasses: 'govuk-tag--yellow'
  },
  late: {
    text: () => t('records.status.late'),
    tagClasses: 'govuk-tag--pink'
  },
  complete: {
    text: () => t('records.status.complete'),
    tagClasses: 'govuk-tag--grey'
  }
}

const UNKNOWN_STATUS_DISPLAY = {
  text: () => t('records.status.unknown'),
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
    return t('records.status.draft')
  }
  if (record.status === 'SUBMITTED' && record.displayStatus !== 'Late') {
    return record.numberOfSubmissions > 1
      ? t('records.status.amended')
      : t('records.status.submitted')
  }
  const statusKey = {
    Amended: 'records.status.amended',
    Complete: 'records.status.complete',
    Draft: 'records.status.draft',
    Late: 'records.status.late',
    Submitted: 'records.status.submitted',
    Unsent: 'records.status.unsent',
    Unknown: 'records.status.unknown'
  }[record.displayStatus]

  return statusKey ? t(statusKey) : record.displayStatus
}
