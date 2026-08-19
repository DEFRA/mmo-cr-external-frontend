// Walkthrough-only mock-data accessor — synchronous, no navigation/render logic.
import { service } from './service.js'
import { account } from './account.js'
import { allRecords } from './records.js'
import { catchRecordDetails } from './catch-record-details.js'
import { selectVessel } from './vessels.js'
import { tripDates } from './trip-dates.js'
import { ports } from './ports.js'
import { gearSelection } from './gear.js'
import { potsDetails } from './pots-details.js'
import {
  nearbyStatisticalAreas,
  statisticalAreas,
  alternativeStatisticalAreaExample
} from './statistical-areas.js'
import { speciesSelection } from './species.js'
import { speciesWeights } from './species-weights.js'
import { catchNotLanded } from './catch-not-landed.js'
import { confirmation } from './confirmation.js'

const dataByKey = {
  service,
  account,
  allRecords,
  catchRecordDetails,
  selectVessel,
  tripDates,
  ports,
  gearSelection,
  potsDetails,
  nearbyStatisticalAreas,
  statisticalAreas,
  alternativeStatisticalAreaExample,
  speciesSelection,
  speciesWeights,
  catchNotLanded,
  confirmation
}

export function getData(pageName) {
  if (!Object.hasOwn(dataByKey, pageName)) {
    throw new Error(`Unknown mock-data key: ${pageName}`)
  }

  return structuredClone(dataByKey[pageName])
}
