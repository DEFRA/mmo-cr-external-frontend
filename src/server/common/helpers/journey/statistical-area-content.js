import { getData } from '#/server/common/data/get-data.js'
import { getGearCatalogue } from '#/server/common/helpers/gear/favourite-gear.js'
import { currentLanguage } from '#/server/common/helpers/i18n/language-context.js'
import { t } from '#/server/common/helpers/i18n/translator.js'

export async function selectedGearDescription(journeyState, gearId) {
  const selectedGearIds = gearId ? [gearId] : journeyState.selectedGearIds || []
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
  return new Intl.ListFormat(currentLanguage(), {
    style: 'long',
    type: 'conjunction'
  }).format(gearNames)
}

export async function statisticalAreaContent(
  journeyState,
  { manualEntry = false, gearId } = {}
) {
  const gears = await selectedGearDescription(journeyState, gearId)
  const baseKey = manualEntry
    ? 'statisticalArea.manualTitle'
    : 'statisticalArea.title'
  const headingKey = gears ? `${baseKey}WithGear` : baseKey
  const heading = t(
    headingKey,
    gears ? { gear: gears.toLowerCase() } : undefined
  )

  return {
    pageTitle: heading,
    heading,
    bodyText: [t('statisticalArea.body1'), t('statisticalArea.body2')]
  }
}
