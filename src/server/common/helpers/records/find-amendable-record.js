import Boom from '@hapi/boom'

import { getData } from '#/server/common/data/get-data.js'
import { canAmendRecord } from '#/server/common/helpers/auth/permissions.js'

// Shared by both edit-catch-record-reason and edit-catch-record-review so the
// 404/403 rules for entering the amendment flow can't drift between the two pages.
export function findAmendableRecord(recordId) {
  const record = getData('allRecords').find(
    (item) => item.recordId === recordId
  )

  if (!record) {
    throw Boom.notFound()
  }

  if (!canAmendRecord()) {
    throw Boom.forbidden()
  }

  return record
}
