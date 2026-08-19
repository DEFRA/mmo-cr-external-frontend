// Record status routing only — record content data lives in the Step 03 mock-data layer.

/**
 * Resolves which placeholder page a record status routes to: an unsent record
 * continues its draft, everything else views a read-only details page.
 */
export function resolveRecordDestination(status) {
  switch (status) {
    case 'unsent':
      return 'draft'
    case 'submitted':
    case 'amended':
    case 'late':
      return 'details'
    default:
      throw new Error(`Unknown record status: ${status}`)
  }
}
