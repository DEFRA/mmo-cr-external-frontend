import { sampleRecords } from '#/server/common/helpers/journey/records.js'

/**
 * Landing page after sign in. Uses the Step 02 placeholder sample records —
 * replaced by the Step 03 mock-data layer.
 */
export const recordsController = {
  handler(_request, h) {
    const records = sampleRecords.map((record) => ({
      recordId: record.recordId,
      status: record.status,
      href: record.status === 'unsent' ? '/draft' : `/records/${record.recordId}`
    }))

    return h.view('records/index', {
      pageTitle: 'Your catch records',
      heading: 'Your catch records',
      records
    })
  }
}
