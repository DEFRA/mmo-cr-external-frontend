import Boom from '@hapi/boom'

import { config } from '#/config/config.js'
import { createSpeciesReferenceDataClient } from '#/server/common/clients/species-reference-data.js'
import {
  getJourneyState,
  getGearJourneyState,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import { loadFavouriteSpecies } from '#/server/common/helpers/journey/session-favourites.js'

function liveCatchRecording() {
  return config.get('catchRecording.enabled')
}

const DEFAULT_AVAILABLE_SPECIES_CODES = new Set(['COD', 'HAD', 'MAC'])

const speciesReferenceDataClient = createSpeciesReferenceDataClient({
  serviceUrl: config.get('referenceData.serviceUrl'),
  token: () => config.get('referenceData.token'),
  timeoutMs: config.get('referenceData.timeoutMs')
})

export async function getSpeciesCatalogue(request) {
  try {
    return await speciesReferenceDataClient.getSpeciesCatalogue(
      request?.headers?.['accept-language']
    )
  } catch {
    throw Boom.serverUnavailable(
      'Species reference data is temporarily unavailable'
    )
  }
}

function speciesIdForCatalogue(speciesId, catalogue) {
  return (
    catalogue.find((species) => species.id === speciesId)?.id ||
    catalogue.find(
      (species) =>
        species.code.toLowerCase() === String(speciesId).toLowerCase()
    )?.id
  )
}

function migrateIds(speciesIds, catalogue) {
  return [
    ...new Set(
      speciesIds
        .map((id) => speciesIdForCatalogue(id, catalogue))
        .filter(Boolean)
    )
  ]
}

function migrateSpeciesDataById(speciesData, catalogue) {
  return Object.entries(speciesData).reduce((migrated, [id, data]) => {
    const speciesId = speciesIdForCatalogue(id, catalogue)
    if (speciesId) {
      migrated[speciesId] = data
    }
    return migrated
  }, {})
}

function assertSavedSpeciesAvailable(journeyState, catalogue) {
  const savedSpeciesIds = [
    ...(journeyState.selectedSpeciesIds || []),
    ...Object.keys(journeyState.speciesNotLanded || {})
  ]
  if (
    liveCatchRecording() &&
    savedSpeciesIds.some(
      (id) => !catalogue.some((species) => species.id === id)
    )
  ) {
    throw Boom.conflict(
      'A saved species is no longer available. This record cannot be edited without changing its saved selections.',
      { catchRecordError: true }
    )
  }
}

function changedValue(original, migrated) {
  return JSON.stringify(migrated) === JSON.stringify(original)
    ? undefined
    : migrated
}

function speciesMigrationPatch(journeyState, catalogue) {
  assertSavedSpeciesAvailable(journeyState, catalogue)
  const patch = {}

  for (const key of ['selectedSpeciesIds', 'availableSpeciesIds']) {
    const value = journeyState[key]
    const migrated =
      Array.isArray(value) && changedValue(value, migrateIds(value, catalogue))
    if (migrated) {
      patch[key] = migrated
    }
  }

  for (const key of ['speciesWeights', 'speciesNotLanded']) {
    const value = journeyState[key]
    const migrated =
      value && changedValue(value, migrateSpeciesDataById(value, catalogue))
    if (migrated) {
      patch[key] = migrated
    }
  }
  return patch
}

function migrateGearSpeciesAnswers(answers, catalogue) {
  return {
    ...answers,
    ...speciesMigrationPatch(answers, catalogue)
  }
}

export function getSpeciesJourneyState(request, catalogue) {
  const journeyState = getJourneyState(request)
  const patch = speciesMigrationPatch(journeyState, catalogue)
  if (journeyState.catchDetailsByGearId) {
    const migrated = Object.fromEntries(
      Object.entries(journeyState.catchDetailsByGearId).map(
        ([gearId, answers]) => [
          gearId,
          migrateGearSpeciesAnswers(answers, catalogue)
        ]
      )
    )
    if (
      JSON.stringify(migrated) !==
      JSON.stringify(journeyState.catchDetailsByGearId)
    ) {
      patch.catchDetailsByGearId = migrated
    }
  }

  if (Object.keys(patch).length > 0) {
    setJourneyState(request, patch)
  }
  return getGearJourneyState(request)
}

export function getAvailableSpeciesIds(journeyState, catalogue) {
  return (
    journeyState.availableSpeciesIds ||
    catalogue
      .filter((species) => DEFAULT_AVAILABLE_SPECIES_CODES.has(species.code))
      .map((species) => species.id)
  )
}

export function getSpeciesOptionsByIds(speciesIds, catalogue) {
  return catalogue.filter((species) => speciesIds.includes(species.id))
}

export async function getSpeciesPageData(
  request,
  { loadFavourites = false, includeSelected = false } = {}
) {
  if (loadFavourites) {
    await loadFavouriteSpecies(request)
  }
  const catalogue = await getSpeciesCatalogue(request)
  const journeyState = getSpeciesJourneyState(request, catalogue)
  const availableSpeciesIds = getAvailableSpeciesIds(journeyState, catalogue)
  if (
    loadFavourites &&
    liveCatchRecording() &&
    journeyState.favouriteSpeciesIds.some(
      (id) => !catalogue.some((species) => species.id === id)
    )
  ) {
    throw Boom.conflict(
      'A favourite species is no longer available in Reference Data. Reload the page before trying again.',
      { catchRecordError: true }
    )
  }
  const optionIds =
    includeSelected && liveCatchRecording()
      ? [
          ...new Set([
            ...availableSpeciesIds,
            ...(journeyState.journeySpeciesIds || []),
            ...(journeyState.selectedSpeciesIds || [])
          ])
        ]
      : availableSpeciesIds

  return {
    catalogue,
    journeyState,
    availableSpeciesIds,
    speciesOptions: getSpeciesOptionsByIds(optionIds, catalogue)
  }
}

export function findSpeciesOptionByLabel(label, catalogue) {
  const normalized = (label || '').trim().toLowerCase()

  if (!normalized) {
    return undefined
  }

  return catalogue.find(
    (species) => species.text.trim().toLowerCase() === normalized
  )
}
