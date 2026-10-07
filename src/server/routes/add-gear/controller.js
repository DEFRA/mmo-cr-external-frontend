import Joi from 'joi'

import {
  getJourneyState,
  resolveNextPath,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import {
  findGearOptionByLabel,
  getFavouriteGearIds,
  getFavouriteGearMeasurements,
  getGearCatalogue,
  getGearOptionById
} from '#/server/common/helpers/gear/favourite-gear.js'
import { validateMeasurement } from '#/server/common/helpers/gear/measurement-validation.js'
import { getData } from '#/server/common/data/get-data.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

const pageTitle = 'What gear did you use?'
const { reference } = getData('confirmation')
const addGearViewName = 'add-gear/index'
const gearSelectionPath = '/gear-selection'
const emptyGearMessage = 'Select the gear you want to add'

// Every measurement field id used across the gear catalogue's `measurements`
// arrays — declared explicitly so Joi only accepts known field names.
const measurementFieldIds = [
  'numberOfTrawlNets',
  'meshSize',
  'numberOfDredges',
  'numberOfTimesShot',
  'rodsAndLines',
  'netLengthHauled',
  'netLengthLeft',
  'totalHauled',
  'totalInWater',
  'totalHooksHauled',
  'totalHooksInWater'
]

// Keeps the "return" query param across the page's own add/measurement redirects
// so "Save and continue" still honours it once the measurement step is done.
function addGearPath(request, { step } = {}) {
  const params = new URLSearchParams()
  if (request.query?.return) {
    params.set('return', request.query.return)
  }
  if (step) {
    params.set('step', step)
  }
  const query = params.toString()
  return query ? `/add-gear?${query}` : '/add-gear'
}

function viewContext(request, overrides = {}) {
  const journeyState = getJourneyState(request)
  const favouriteGearIds = getFavouriteGearIds(journeyState)
  const pendingGearId = journeyState.addGearPendingId
  const pendingOption = pendingGearId && getGearOptionById(pendingGearId)

  return {
    pageTitle,
    heading: pendingOption
      ? `Enter the measurements for ${pendingOption.label.toLowerCase()}`
      : pageTitle,
    caption: reference,
    backLink: {
      href: resolveNextPath(request, gearSelectionPath),
      text: 'Back'
    },
    pendingOption,
    gearOptionLabels: getGearCatalogue()
      .filter((option) => !favouriteGearIds.includes(option.id))
      .map((option) => option.label),
    ...overrides
  }
}

function renderSearchError(request, h, errorText) {
  return h
    .view(
      addGearViewName,
      viewContext(request, {
        errorSummary: {
          titleText: 'There is a problem',
          errorList: [{ text: errorText, href: '#gear' }]
        },
        fieldErrors: { gear: errorText }
      })
    )
    .code(statusCodes.badRequest)
    .takeover()
}

function renderMeasurementErrors(request, h, errorList, fieldErrors) {
  return h
    .view(
      addGearViewName,
      viewContext(request, {
        errorSummary: { titleText: 'There is a problem', errorList },
        fieldErrors
      })
    )
    .code(statusCodes.badRequest)
    .takeover()
}

export const addGearController = {
  handler(request, h) {
    // A plain /add-gear visit is a fresh start, so drop any abandoned measurement entry.
    if (
      request.query.step !== measurementStep &&
      getJourneyState(request).addGearPendingId
    ) {
      setJourneyState(request, { addGearPendingId: null })
    }
    return h.view(addGearViewName, viewContext(request))
  }
}

function handlePendingMeasurementSubmission(
  request,
  h,
  journeyState,
  pendingOption
) {
  const errorList = []
  const fieldErrors = {}
  const values = {}

  for (const measurement of pendingOption.measurements) {
    const { value, error } = validateMeasurement(
      request.payload[measurement.id],
      measurement
    )

    if (error) {
      errorList.push({ text: error, href: `#${measurement.id}` })
      fieldErrors[measurement.id] = error
    } else {
      values[measurement.id] = value
    }
  }

  if (errorList.length) {
    return renderMeasurementErrors(request, h, errorList, fieldErrors)
  }

  const favouriteGearIds = getFavouriteGearIds(journeyState)
  const favouriteGearMeasurements = getFavouriteGearMeasurements(journeyState)

  setJourneyState(request, {
    favouriteGearIds: favouriteGearIds.includes(pendingOption.id)
      ? favouriteGearIds
      : [...favouriteGearIds, pendingOption.id],
    favouriteGearMeasurements: {
      ...favouriteGearMeasurements,
      [pendingOption.id]: values
    },
    addGearPendingId: null
  })

  return h
    .redirect(resolveNextPath(request, gearSelectionPath))
    .code(statusCodes.seeOther)
}

function handleGearSearchSubmission(request, h, journeyState) {
  const gearLabel = (request.payload.gear || '').trim()

  if (!gearLabel) {
    return renderSearchError(request, h, emptyGearMessage)
  }

  const matchedOption = findGearOptionByLabel(gearLabel)

  if (!matchedOption) {
    return renderSearchError(request, h, 'Select a gear type from the list')
  }

  if (matchedOption.measurements) {
    setJourneyState(request, { addGearPendingId: matchedOption.id })
    return h
      .redirect(addGearPath(request, { step: measurementStep }))
      .code(statusCodes.seeOther)
  }

  const favouriteGearIds = getFavouriteGearIds(journeyState)

  if (!favouriteGearIds.includes(matchedOption.id)) {
    setJourneyState(request, {
      favouriteGearIds: [...favouriteGearIds, matchedOption.id]
    })
  }

  return h
    .redirect(resolveNextPath(request, gearSelectionPath))
    .code(statusCodes.seeOther)
}

export const addGearSubmitController = {
  options: {
    validate: {
      payload: Joi.object({
        gear: Joi.string().allow(''),
        ...Object.fromEntries(
          measurementFieldIds.map((id) => [id, Joi.string().allow('')])
        )
      }),
      failAction(request, h) {
        return renderSearchError(request, h, emptyGearMessage)
      }
    }
  },
  handler(request, h) {
    const journeyState = getJourneyState(request)
    const pendingGearId = journeyState.addGearPendingId
    const pendingOption = pendingGearId && getGearOptionById(pendingGearId)

    return pendingOption
      ? handlePendingMeasurementSubmission(
          request,
          h,
          journeyState,
          pendingOption
        )
      : handleGearSearchSubmission(request, h, journeyState)
  }
}
