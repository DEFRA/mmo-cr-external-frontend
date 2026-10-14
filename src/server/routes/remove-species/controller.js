import {
  resolveNextPath,
  getJourneyState,
  speciesSelectionReturnPath,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import { filterKnownSpeciesIds } from '#/server/common/helpers/species/species-form.js'
import { getSpeciesPageData } from '#/server/common/helpers/species/species-list.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

const pageTitle = 'Remove a species'
function speciesCheckboxItems(speciesOptions) {
  return speciesOptions.map((species) => ({
    value: species.id,
    text: species.text
  }))
}

function viewContext(request, speciesData, overrides = {}) {
  return {
    pageTitle,
    heading: pageTitle,
    caption: 'New catch record',
    backLink: {
      href: speciesSelectionReturnPath(request),
      text: 'Back'
    },
    speciesCheckboxItems: speciesCheckboxItems(speciesData.speciesOptions),
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
  async handler(request, h) {
    const speciesData = await getSpeciesPageData(request)
    return h.view('remove-species/index', viewContext(request, speciesData))
  }
}

function withoutRemovedSpecies(data, idsToRemove) {
  return Object.fromEntries(
    Object.entries(data || {}).filter(([id]) => !idsToRemove.includes(id))
  )
}

function remainingCatchAnswers(answers, idsToRemove) {
  return {
    ...answers,
    selectedSpeciesIds: (answers.selectedSpeciesIds || []).filter(
      (id) => !idsToRemove.includes(id)
    ),
    speciesWeights: withoutRemovedSpecies(answers.speciesWeights, idsToRemove),
    speciesNotLanded: withoutRemovedSpecies(
      answers.speciesNotLanded,
      idsToRemove
    )
  }
}

function removeSpeciesFromJourney(request, availableSpeciesIds, idsToRemove) {
  const state = getJourneyState(request)
  const patch = {
    ...remainingCatchAnswers(state, idsToRemove),
    availableSpeciesIds: availableSpeciesIds.filter(
      (id) => !idsToRemove.includes(id)
    )
  }
  if (state.catchDetailsByGearId) {
    patch.catchDetailsByGearId = Object.fromEntries(
      Object.entries(state.catchDetailsByGearId).map(([gearId, answers]) => [
        gearId,
        remainingCatchAnswers(answers, idsToRemove)
      ])
    )
  }
  setJourneyState(request, patch)
  return patch.availableSpeciesIds
}

export const removeSpeciesSubmitController = {
  async handler(request, h) {
    const speciesData = await getSpeciesPageData(request)
    const { availableSpeciesIds } = speciesData

    if (availableSpeciesIds.length === 0) {
      return h
        .redirect(resolveNextPath(request, '/add-species'))
        .code(statusCodes.seeOther)
    }

    const requestedIds = normalizeSpeciesIds(request.payload.speciesIds)
    const idsToRemove = filterKnownSpeciesIds(
      requestedIds,
      speciesData.speciesOptions
    ).filter((id) => availableSpeciesIds.includes(id))

    if (idsToRemove.length === 0) {
      const errorText = 'Select the species you want to remove'

      return h
        .view(
          'remove-species/index',
          viewContext(request, speciesData, {
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

    const remainingSpeciesIds = removeSpeciesFromJourney(
      request,
      availableSpeciesIds,
      idsToRemove
    )

    if (remainingSpeciesIds.length === 0) {
      return h
        .redirect(resolveNextPath(request, '/add-species'))
        .code(statusCodes.seeOther)
    }

    return h
      .redirect(speciesSelectionReturnPath(request))
      .code(statusCodes.seeOther)
  }
}
