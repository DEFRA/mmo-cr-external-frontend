// Status display mapping only (label + govukTag colour) — routing lives in journey/records.js.
const STATUS_DISPLAY = {
  submitted: { text: 'Submitted', tagClasses: 'govuk-tag--green' },
  amended: { text: 'Amended', tagClasses: 'govuk-tag--blue' },
  draft: { text: 'Draft', tagClasses: 'govuk-tag--yellow' },
  unsent: { text: 'Unsent', tagClasses: 'govuk-tag--yellow' },
  late: { text: 'Late', tagClasses: 'govuk-tag--pink' }
}

const UNKNOWN_STATUS_DISPLAY = {
  text: 'Unknown',
  tagClasses: 'govuk-tag--grey'
}

/**
 * Resolves the govukTag text/colour for a record status. Falls back to a
 * neutral, safe display for any unrecognised status.
 */
export function getStatusDisplay(status) {
  return STATUS_DISPLAY[status] ?? UNKNOWN_STATUS_DISPLAY
}

export function getRecordDisplayStatus(record) {
  if (record.status === 'DRAFT') return 'Draft'
  if (record.status === 'SUBMITTED' && record.displayStatus !== 'Late') {
    return record.numberOfSubmissions > 1 ? 'Amended' : 'Submitted'
  }
  return record.displayStatus
}
