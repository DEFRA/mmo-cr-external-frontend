import { getData } from '#/server/common/data/get-data.js'
import { getGearCatalogue } from '#/server/common/helpers/gear/favourite-gear.js'

export async function selectedGearDescription(journeyState) {
  const selectedGearIds = journeyState.selectedGearIds || []
  let catalogue = getData('gearCatalogue')
  if (
    selectedGearIds.some(
      (id) =>
        !journeyState.selectedGearNamesById?.[id] &&
        !catalogue.some((gear) => gear.id === id)
    )
  ) {
    catalogue = [
      ...catalogue,
      ...(await getGearCatalogue({
        vesselLengthMetres: journeyState.selectedVesselLengthOverallMetres
      }))
    ]
  }
  const gearNames = selectedGearIds
    .map(
      (id) =>
        journeyState.selectedGearNamesById?.[id] ||
        catalogue.find((gear) => gear.id === id)?.name ||
        catalogue.find((gear) => gear.id === id)?.label
    )
    .filter(Boolean)
    .map((name) => name.toLowerCase())
  return new Intl.ListFormat('en', {
    style: 'long',
    type: 'conjunction'
  }).format(gearNames)
}

export async function statisticalAreaContent(journeyState) {
  const gears = await selectedGearDescription(journeyState)
  const heading = `Select the statistical sub area where the majority of your catch was caught${gears ? ` using ${gears}` : ''}`

  return {
    pageTitle: heading,
    heading,
    bodyText: [
      'The statistical areas nearest to your departure port are shown below. Select the area where most of your catch was caught.',
      "If it is not listed, select 'Other' to enter it."
    ]
  }
}
