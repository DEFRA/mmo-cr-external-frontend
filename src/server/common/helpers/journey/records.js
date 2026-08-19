// Placeholder sample record data — replaced by the Step 03 mock-data layer.
export const sampleRecords = [
  { recordId: 'unsent-1', status: 'unsent' },
  { recordId: 'submitted-1', status: 'submitted' },
  { recordId: 'amended-1', status: 'amended' },
  { recordId: 'late-1', status: 'late' }
]

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
