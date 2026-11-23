import { t } from '#/server/common/helpers/i18n/translator.js'

import {
  catchRecordCaption,
  isCatchRecordJourney,
  resolveNextPath,
  getJourneyState,
  speciesSelectionReturnPath,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import { filterKnownSpeciesIds } from '#/server/common/helpers/species/species-form.js'
import { getSpeciesPageData } from '#/server/common/helpers/species/species-list.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import { removeFavouriteSpecies } from '#/server/common/helpers/journey/session-favourites.js'
import { liveCatchRecords } from '#/server/common/helpers/journey/catch-record-service.js'

function speciesCheckboxItems(speciesOptions) {
  return speciesOptions.map((species) => ({
    value: species.id,
    text: species.text
  }))
}

function viewContext(request, speciesData, overrides = {}) {
  const favourites = liveCatchRecords() && !isCatchRecordJourney(request)
  const vesselName = speciesData.journeyState.selectedVesselName || ''
  const heading = t('removeSpecies.title')
  const pageTitle = vesselName ? `${heading} ${vesselName}` : heading
  return {
    pageTitle,
    heading,
    vesselName,
    caption: favourites
      ? t('common.yourFavourites')
      : catchRecordCaption(request),
    backLink: {
      href: speciesSelectionReturnPath(request),
      text: t('header.back')
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

// During a live trip the species selection page also lists trip-only and
// saved record species, so the remove page must offer the same set.
function loadRemovableSpecies(request) {
  return getSpeciesPageData(request, {
    loadFavourites: true,
    includeSelected: isCatchRecordJourney(request)
  })
}

export const removeSpeciesController = {
  async handler(request, h) {
    const speciesData = await loadRemovableSpecies(request)
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

function remainingTripSpecies(state, idsToRemove) {
  const patch = remainingCatchAnswers(state, idsToRemove)
  if (state.catchDetailsByGearId) {
    patch.catchDetailsByGearId = Object.fromEntries(
      Object.entries(state.catchDetailsByGearId).map(([gearId, answers]) => [
        gearId,
        remainingCatchAnswers(answers, idsToRemove)
      ])
    )
  }
  return patch
}

function removeSpeciesFromTrip(request, idsToRemove) {
  const state = getJourneyState(request)
  setJourneyState(request, {
    ...remainingTripSpecies(state, idsToRemove),
    journeySpeciesIds: (state.journeySpeciesIds || []).filter(
      (id) => !idsToRemove.includes(id)
    )
  })
}

function removeSpeciesFromJourney(request, availableSpeciesIds, idsToRemove) {
  const patch = {
    ...remainingTripSpecies(getJourneyState(request), idsToRemove),
    availableSpeciesIds: availableSpeciesIds.filter(
      (id) => !idsToRemove.includes(id)
    )
  }
  setJourneyState(request, patch)
  return patch.availableSpeciesIds
}

export const removeSpeciesSubmitController = {
  async handler(request, h) {
    const speciesData = await loadRemovableSpecies(request)
    const { availableSpeciesIds } = speciesData
    const removableSpeciesIds = speciesData.speciesOptions.map(({ id }) => id)

    if (removableSpeciesIds.length === 0) {
      return h
        .redirect(resolveNextPath(request, '/add-species'))
        .code(statusCodes.seeOther)
    }

    const requestedIds = normalizeSpeciesIds(request.payload.speciesIds)
    const idsToRemove = filterKnownSpeciesIds(
      requestedIds,
      speciesData.speciesOptions
    ).filter((id) => removableSpeciesIds.includes(id))

    if (idsToRemove.length === 0) {
      const errorText = t('removeSpecies.error.select')

      return h
        .view(
          'remove-species/index',
          viewContext(request, speciesData, {
            errorSummary: {
              titleText: t('common.errorSummary.title'),
              errorList: [{ text: errorText, href: '#speciesIds' }]
            },
            fieldErrors: { speciesIds: errorText }
          })
        )
        .code(statusCodes.badRequest)
        .takeover()
    }

    let remainingSpeciesIds
    if (liveCatchRecords()) {
      const favouriteIdsToRemove = idsToRemove.filter((id) =>
        availableSpeciesIds.includes(id)
      )
      if (favouriteIdsToRemove.length) {
        await removeFavouriteSpecies(request, favouriteIdsToRemove)
      }
      if (isCatchRecordJourney(request)) {
        removeSpeciesFromTrip(request, idsToRemove)
      }
      remainingSpeciesIds = removableSpeciesIds.filter(
        (id) => !idsToRemove.includes(id)
      )
    } else {
      remainingSpeciesIds = removeSpeciesFromJourney(
        request,
        availableSpeciesIds,
        idsToRemove
      )
    }

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
