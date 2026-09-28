// BR-SUB-011: captures the audit trail (reason, timestamp, user) for a record amendment.
// Kept in memory only, as this mock app has no real database - entries live for the
// lifetime of the server process rather than being durably persisted.
const auditLog = []

export function recordAmendment(entry) {
  auditLog.push(entry)
  return entry
}

export function getAmendmentHistory(recordId) {
  return auditLog.filter((entry) => entry.recordId === recordId)
}
