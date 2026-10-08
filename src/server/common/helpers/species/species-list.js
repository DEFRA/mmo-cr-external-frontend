import Boom from '@hapi/boom'

import { config } from '#/config/config.js'
import { createSpeciesReferenceDataClient } from '#/server/common/clients/species-reference-data.js'
import {
  getJourneyState,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'

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

export function getSpeciesJourneyState(request, catalogue) {
  const journeyState = getJourneyState(request)
  const patch = {}

  for (const key of ['selectedSpeciesIds', 'availableSpeciesIds']) {
    if (Array.isArray(journeyState[key])) {
      const migratedIds = migrateIds(journeyState[key], catalogue)
      if (JSON.stringify(migratedIds) !== JSON.stringify(journeyState[key])) {
        patch[key] = migratedIds
      }
    }
  }

  for (const key of ['speciesWeights', 'speciesNotLanded']) {
    if (journeyState[key]) {
      const migratedData = migrateSpeciesDataById(journeyState[key], catalogue)
      if (JSON.stringify(migratedData) !== JSON.stringify(journeyState[key])) {
        patch[key] = migratedData
      }
    }
  }

  return Object.keys(patch).length > 0
    ? setJourneyState(request, patch)
    : journeyState
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

export async function getSpeciesPageData(request) {
  const catalogue = await getSpeciesCatalogue(request)
  const journeyState = getSpeciesJourneyState(request, catalogue)
  const availableSpeciesIds = getAvailableSpeciesIds(journeyState, catalogue)

  return {
    catalogue,
    journeyState,
    availableSpeciesIds,
    speciesOptions: getSpeciesOptionsByIds(availableSpeciesIds, catalogue)
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
