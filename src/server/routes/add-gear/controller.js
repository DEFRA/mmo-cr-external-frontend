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
  getGearOptionById,
  getGearItem
} from '#/server/common/helpers/gear/favourite-gear.js'
import { validateMeasurement } from '#/server/common/helpers/gear/measurement-validation.js'
import { getData } from '#/server/common/data/get-data.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

const pageTitle = 'What gear did you use?'
const { reference } = getData('confirmation')
const addGearViewName = 'add-gear/index'
const gearSelectionPath = '/gear-selection'
const measurementStep = 'measurements'
const emptyGearMessage = 'Select the gear you want to add'

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

function viewContext(request, catalogue, overrides = {}) {
  const journeyState = getJourneyState(request)
  const favouriteGearIds = getFavouriteGearIds(journeyState, catalogue)
  const pendingGearId = journeyState.addGearPendingId
  const pendingOption =
    pendingGearId && getGearOptionById(pendingGearId, catalogue)

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
    gearOptionLabels: catalogue
      .filter((option) => option.id !== 'pots')
      .filter((option) => !favouriteGearIds.includes(option.id))
      .map((option) => option.label),
    ...overrides
  }
}

function renderSearchError(request, h, catalogue, errorText) {
  return h
    .view(
      addGearViewName,
      viewContext(request, catalogue, {
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

function renderMeasurementErrors(
  request,
  h,
  catalogue,
  errorList,
  fieldErrors
) {
  return h
    .view(
      addGearViewName,
      viewContext(request, catalogue, {
        errorSummary: { titleText: 'There is a problem', errorList },
        fieldErrors
      })
    )
    .code(statusCodes.badRequest)
    .takeover()
}

export const addGearController = {
  async handler(request, h) {
    if (
      request.query.step !== measurementStep &&
      getJourneyState(request).addGearPendingId
    ) {
      setJourneyState(request, { addGearPendingId: null })
    }
    const catalogue = await getGearCatalogue({
      vesselLengthMetres:
        getJourneyState(request).selectedVesselLengthOverallMetres
    })
    return h.view(addGearViewName, viewContext(request, catalogue))
  }
}

function handlePendingMeasurementSubmission(
  request,
  h,
  journeyState,
  pendingOption,
  catalogue
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
    return renderMeasurementErrors(
      request,
      h,
      catalogue,
      errorList,
      fieldErrors
    )
  }

  const favouriteGearIds = getFavouriteGearIds(journeyState, catalogue)
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

async function handleGearSearchSubmission(request, h, journeyState, catalogue) {
  const gearLabel = (request.payload.gear || '').trim()

  if (!gearLabel) {
    return renderSearchError(request, h, catalogue, emptyGearMessage)
  }

  const matchedOption = findGearOptionByLabel(
    gearLabel,
    catalogue.filter((gear) => gear.id !== 'pots')
  )

  if (!matchedOption) {
    return renderSearchError(
      request,
      h,
      catalogue,
      'Select a gear type from the list'
    )
  }

  await getGearItem(matchedOption.id)
  if (matchedOption.measurements?.length) {
    setJourneyState(request, { addGearPendingId: matchedOption.id })
    return h
      .redirect(addGearPath(request, { step: measurementStep }))
      .code(statusCodes.seeOther)
  }

  const favouriteGearIds = getFavouriteGearIds(journeyState, catalogue)

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
        gear: Joi.string().allow('')
      }).unknown(true),
      async failAction(request, h) {
        const catalogue = await getGearCatalogue({
          vesselLengthMetres:
            getJourneyState(request).selectedVesselLengthOverallMetres
        })
        return renderSearchError(request, h, catalogue, emptyGearMessage)
      }
    }
  },
  async handler(request, h) {
    const journeyState = getJourneyState(request)
    const catalogue = await getGearCatalogue({
      vesselLengthMetres: journeyState.selectedVesselLengthOverallMetres
    })
    const pendingGearId = journeyState.addGearPendingId
    const pendingOption =
      pendingGearId && getGearOptionById(pendingGearId, catalogue)

    if (pendingOption) {
      const allowedFields = new Set(
        pendingOption.measurements.map(({ id }) => id)
      )
      const hasUnknownFields = Object.keys(request.payload || {}).some(
        (key) => key !== 'gear' && !allowedFields.has(key)
      )
      if (hasUnknownFields) {
        return renderMeasurementErrors(request, h, catalogue, [], {})
      }
      return handlePendingMeasurementSubmission(
        request,
        h,
        journeyState,
        pendingOption,
        catalogue
      )
    }
    return handleGearSearchSubmission(request, h, journeyState, catalogue)
  }
}
