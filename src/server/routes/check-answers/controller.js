import { getData } from '#/server/common/data/get-data.js'
import { getSpeciesPageData } from '#/server/common/helpers/species/species-list.js'
import { getGearCatalogue } from '#/server/common/helpers/gear/favourite-gear.js'
import { buildCheckAnswersViewModel } from './view-model.js'

async function viewContext(request) {
  const { catalogue, journeyState } = await getSpeciesPageData(request)
  const gearCatalogue = await getGearCatalogue()
  const { sections } = buildCheckAnswersViewModel(request, {
    speciesCatalogue: catalogue,
    gearCatalogue,
    readOnly: true
  })
  const fallback = getData('catchRecordDetails')
  const vesselName = sections[0].rows.find((row) => row.key.text === 'Vessel')
    .value.text
  const heading = `Catch record for ${vesselName}`

  return {
    pageTitle: heading,
    heading,
    backLink: {
      href: '/records',
      text: 'Back'
    },
    details: {
      ...fallback,
      vesselName,
      reference: journeyState.reference || fallback.reference
    },
    sections,
    readOnly: true
  }
}

export const checkAnswersController = {
  async handler(request, h) {
    return h.view('record-details/index', await viewContext(request))
  }
}
