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
import { initialiseClearInputErrors } from './clear-input-error.js'

createAll(Button)
createAll(Checkboxes)
createAll(ErrorSummary)
createAll(Radios)
createAll(SkipLink)

initialiseStatisticalAreaMap()
initialiseStatisticalAreaSearch()
initialisePortSearch()
initialiseClearInputErrors()
