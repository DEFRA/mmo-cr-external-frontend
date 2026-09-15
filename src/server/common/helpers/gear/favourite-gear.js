// "Favourite gear" (CRAR-158/CRAR-159) has no real backend in this mock app — favourites
// live in the session's journeyState, seeded with the original static gear list so
// existing journeys keep working unchanged until the user adds or removes something.
import { getData } from '#/server/common/data/get-data.js'

const catalogue = [...getData('gearCatalogue')].sort(
  (a, b) => a.displayOrder - b.displayOrder
)
const catalogueById = new Map(catalogue.map((option) => [option.id, option]))
const defaultFavouriteGearIds = getData('gearSelection').map(
  (option) => option.id
)

export function getGearCatalogue() {
  return catalogue
}

export function getFavouriteGearIds(journeyState) {
  return journeyState.favouriteGearIds || defaultFavouriteGearIds
}

export function getFavouriteGearOptions(favouriteGearIds) {
  return favouriteGearIds
    .map((id) => catalogueById.get(id))
    .filter(Boolean)
    .sort((a, b) => a.displayOrder - b.displayOrder)
}

export function findGearOptionByLabel(label) {
  const normalized = label.trim().toLowerCase()
  return catalogue.find((option) => option.label.toLowerCase() === normalized)
}
