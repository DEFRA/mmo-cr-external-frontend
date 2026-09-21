import { getData } from '#/server/common/data/get-data.js'

const defaultAvailableSpeciesIds = getData('speciesSelection').map(
  (species) => species.id
)

export function getSpeciesCatalogue() {
  return getData('speciesCatalogue').sort(
    (a, b) => a.displayOrder - b.displayOrder
  )
}

export function getAvailableSpeciesIds(journeyState) {
  return journeyState.availableSpeciesIds || defaultAvailableSpeciesIds
}

export function getSpeciesOptionsByIds(speciesIds) {
  return getSpeciesCatalogue().filter((species) =>
    speciesIds.includes(species.id)
  )
}

export function findSpeciesOptionByLabel(label) {
  const normalized = (label || '').trim().toLowerCase()

  if (!normalized) {
    return undefined
  }

  return getSpeciesCatalogue().find(
    (species) => species.text.trim().toLowerCase() === normalized
  )
}
