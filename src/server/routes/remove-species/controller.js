import {
  getJourneyState,
  resolveNextPath,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import {
  getAvailableSpeciesIds,
  getSpeciesOptionsByIds
} from '#/server/common/helpers/species/species-list.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

const pageTitle = 'Remove a species'

function speciesCheckboxItems(speciesOptions) {
  return speciesOptions.map((species) => ({
    value: species.id,
    text: species.text
  }))
}

function viewContext(request, overrides = {}) {
  const availableSpeciesIds = getAvailableSpeciesIds(getJourneyState(request))

  return {
    pageTitle,
    heading: pageTitle,
    caption: 'New catch record',
    backLink: {
      href: '/species-selection',
      text: 'Back'
    },
    speciesCheckboxItems: speciesCheckboxItems(
      getSpeciesOptionsByIds(availableSpeciesIds)
    ),
    ...overrides
  }
}

function normalizeSpeciesIds(rawValue) {
  if (rawValue === undefined) {
    return []
  }

  return Array.isArray(rawValue) ? rawValue : [rawValue]
}

export const removeSpeciesController = {
  handler(request, h) {
    return h.view('remove-species/index', viewContext(request))
  }
}

export const removeSpeciesSubmitController = {
  handler(request, h) {
    const journeyState = getJourneyState(request)
    const availableSpeciesIds = getAvailableSpeciesIds(journeyState)
    const requestedIds = normalizeSpeciesIds(request.payload.speciesIds)
    const idsToRemove = requestedIds.filter((id) =>
      availableSpeciesIds.includes(id)
    )

    if (idsToRemove.length === 0) {
      const errorText = 'Select the species you want to remove'

      return h
        .view(
          'remove-species/index',
          viewContext(request, {
            errorSummary: {
              titleText: 'There is a problem',
              errorList: [{ text: errorText, href: '#speciesIds' }]
            },
            fieldErrors: { speciesIds: errorText }
          })
        )
        .code(statusCodes.badRequest)
        .takeover()
    }

    const remainingSpeciesIds = availableSpeciesIds.filter(
      (id) => !idsToRemove.includes(id)
    )
    const remainingSelectedSpeciesIds = (
      journeyState.selectedSpeciesIds || []
    ).filter((id) => !idsToRemove.includes(id))

    const patch = {
      availableSpeciesIds: remainingSpeciesIds,
      selectedSpeciesIds: remainingSelectedSpeciesIds
    }

    // Removing a species removes its catch-weight data too (BR1).
    const speciesWeights = { ...journeyState.speciesWeights }

    idsToRemove.forEach((id) => {
      delete speciesWeights[id]
    })

    patch.speciesWeights = speciesWeights

    setJourneyState(request, patch)

    if (remainingSpeciesIds.length === 0) {
      return h.redirect('/add-species').code(statusCodes.seeOther)
    }

    return h
      .redirect(resolveNextPath(request, '/species-selection'))
      .code(statusCodes.seeOther)
  }
}
