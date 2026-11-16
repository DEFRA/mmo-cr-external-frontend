import { addDaysToIsoDate } from './date-input.js'

// Provisional service launch floor: no trip may start before this date.
export const MIN_DEPARTURE_DATE = '2025-07-24'
// A trip may start at most this many days before the date of entry (inclusive).
export const MAX_TRIP_START_AGE_DAYS = 365
// A trip's length (return date minus departure date) may be at most this many days.
export const MAX_TRIP_LENGTH_DAYS = 30

export const TRIP_TOO_FAR_IN_PAST_MESSAGE = `Date you left for your trip cannot be more than ${MAX_TRIP_START_AGE_DAYS} days in the past`
export const TRIP_TOO_LONG_MESSAGE = `Your trip cannot be longer than ${MAX_TRIP_LENGTH_DAYS} days`

/**
 * The earliest departure date allowed on `today`, and the message to show when a date is earlier: the
 * later of the launch floor and the rolling 365-day backdating window.
 * @param {string} today ISO business date
 * @returns {{ minDate: string, minDateMessage: string }}
 */
export function earliestDepartureDate(today) {
  const rollingFloor = addDaysToIsoDate(today, -MAX_TRIP_START_AGE_DAYS)

  return Date.parse(rollingFloor) > Date.parse(MIN_DEPARTURE_DATE)
    ? { minDate: rollingFloor, minDateMessage: TRIP_TOO_FAR_IN_PAST_MESSAGE }
    : {
        minDate: MIN_DEPARTURE_DATE,
        minDateMessage:
          'Date you left for your trip must be on or after 24 July 2025'
      }
}

export function latestReturnDate(departureDate) {
  return addDaysToIsoDate(departureDate, MAX_TRIP_LENGTH_DAYS)
}

export function earliestDepartureForReturn(returnDate) {
  return addDaysToIsoDate(returnDate, -MAX_TRIP_LENGTH_DAYS)
}
