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

export const removeSpeciesSubmitController = {
  async handler(request, h) {
    const speciesData = await getSpeciesPageData(request)
    const { availableSpeciesIds } = speciesData
    const journeyState = getJourneyState(request)

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
    patch.speciesNotLanded = Object.fromEntries(
      Object.entries(journeyState.speciesNotLanded || {}).filter(
        ([id]) => !idsToRemove.includes(id)
      )
    )
    if (journeyState.catchDetailsByGearId) {
      patch.catchDetailsByGearId = Object.fromEntries(
        Object.entries(journeyState.catchDetailsByGearId).map(
          ([gearId, answers]) => [
            gearId,
            {
              ...answers,
              selectedSpeciesIds: (answers.selectedSpeciesIds || []).filter(
                (id) => !idsToRemove.includes(id)
              ),
              speciesWeights: Object.fromEntries(
                Object.entries(answers.speciesWeights || {}).filter(
                  ([id]) => !idsToRemove.includes(id)
                )
              ),
              speciesNotLanded: Object.fromEntries(
                Object.entries(answers.speciesNotLanded || {}).filter(
                  ([id]) => !idsToRemove.includes(id)
                )
              )
            }
          ]
        )
      )
    }

    setJourneyState(request, patch)

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
