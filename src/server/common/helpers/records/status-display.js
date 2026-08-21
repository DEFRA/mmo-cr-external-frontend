// Status display mapping only (label + govukTag colour) — routing lives in journey/records.js.
const STATUS_DISPLAY = {
  submitted: { text: 'Submitted', tagClasses: 'govuk-tag--green' },
  amended: { text: 'Amended', tagClasses: '' },
  unsent: { text: 'Unsent', tagClasses: 'govuk-tag--yellow' },
  late: { text: 'Late', tagClasses: 'govuk-tag--red' }
}

const UNKNOWN_STATUS_DISPLAY = {
  text: 'Unknown',
  tagClasses: 'govuk-tag--grey'
}

/**
 * Resolves the govukTag text/colour for a record status. Falls back to a
 * neutral, safe display for any status outside the four canonical values.
 */
export function getStatusDisplay(status) {
  return STATUS_DISPLAY[status] ?? UNKNOWN_STATUS_DISPLAY
}
