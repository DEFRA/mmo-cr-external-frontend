import { getData } from '#/server/common/data/get-data.js'

// BR-SUB-014: internal MMO staff may not amend a record themselves - only the vessel
// owner/skipper or a helpline agent acting on their behalf can.
const BLOCKED_AMENDMENT_ROLES = ['Internal user']

export function canAmendRecord() {
  return !BLOCKED_AMENDMENT_ROLES.includes(getData('account').role)
}
