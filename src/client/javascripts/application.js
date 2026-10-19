import {
  createAll,
  Button,
  Checkboxes,
  ErrorSummary,
  Radios,
  SkipLink
} from 'govuk-frontend'
import { initialiseStatisticalAreaMap } from './modules/statistical-area-map.js'
import { initialiseStatisticalAreaSearch } from './modules/statistical-area-search.js'
import { initialisePortSearch } from './modules/port-search.js'
import { initialiseSpeciesSearch } from './modules/species-search.js'
import { initialiseClearInputErrors } from './clear-input-error.js'

import { initSpeciesWeightToggle } from './species-weight-toggle.js'
import { initialiseGuidancePrintButton } from './guidance-print.js'

createAll(Button)
createAll(Checkboxes)
createAll(ErrorSummary)
createAll(Radios)
createAll(SkipLink)
initSpeciesWeightToggle()
initialiseGuidancePrintButton()
initialiseSpeciesSearch()
await initialiseStatisticalAreaMap()
await initialiseStatisticalAreaSearch()
initialisePortSearch()
initialiseClearInputErrors()
