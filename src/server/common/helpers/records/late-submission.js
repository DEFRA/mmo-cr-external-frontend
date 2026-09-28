const LATE_SUBMISSION_HOURS = 24
const MS_PER_HOUR = 60 * 60 * 1000

// BR-SUB-003: a trip is a late submission once more than 24 hours have passed since
// the end of the day the vessel returned, evaluated dynamically against "now" rather
// than a fixed/hardcoded record.
export function isLateSubmission(returnDateIso, now = new Date()) {
  if (!returnDateIso) {
    return false
  }

  const endOfReturnDay = new Date(`${returnDateIso}T23:59:59.999Z`)
  return (
    now.getTime() - endOfReturnDay.getTime() >
    LATE_SUBMISSION_HOURS * MS_PER_HOUR
  )
}
