import { getData } from '#/server/common/data/get-data.js'
import { getSpeciesPageData } from '#/server/common/helpers/species/species-list.js'
import { getGearCatalogue } from '#/server/common/helpers/gear/favourite-gear.js'
import {
  backForCheckAnswers,
  getJourneyState,
  incompleteGearPath
} from '#/server/common/helpers/journey/navigation.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import { buildCheckAnswersViewModel } from './view-model.js'

async function viewContext(request) {
  const { catalogue, journeyState } = await getSpeciesPageData(request)
  const gearCatalogue = await getGearCatalogue()
  const summary = buildCheckAnswersViewModel(request, {
    speciesCatalogue: catalogue,
    gearCatalogue,
    reviewLayout: true
  })
  const fallback = getData('catchRecordDetails')
  const heading = 'Check your catch record'

  return {
    pageTitle: heading,
    heading,
    backLink: {
      href: backForCheckAnswers(request),
      text: 'Back'
    },
    reference: journeyState.reference || fallback.reference,
    ...summary
  }
}

export const checkAnswersController = {
  async handler(request, h) {
    return h.view('check-answers/index', await viewContext(request))
  }
}

export const checkAnswersSubmitController = {
  handler(request, h) {
    const incompletePath =
      incompleteGearPath(request) ||
      (!getJourneyState(request).selectedGearIds?.length
        ? '/gear-selection'
        : null)
    if (incompletePath) {
      return h.redirect(incompletePath).code(statusCodes.seeOther)
    }

    return h.redirect('/confirmation').code(statusCodes.seeOther)
  }
}
