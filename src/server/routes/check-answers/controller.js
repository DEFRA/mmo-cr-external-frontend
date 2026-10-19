import { statusCodes } from '#/server/common/constants/status-codes.js'
import {
  backForCheckAnswers,
  incompleteGearPath
} from '#/server/common/helpers/journey/navigation.js'
import { getSpeciesPageData } from '#/server/common/helpers/species/species-list.js'
import { getGearCatalogue } from '#/server/common/helpers/gear/favourite-gear.js'
import { buildCheckAnswersViewModel } from './view-model.js'

const pageTitle = 'Check your answers'

async function viewContext(request) {
  const { catalogue } = await getSpeciesPageData(request)
  const gearCatalogue = await getGearCatalogue()
  const { sections, gearGroups, trailingSections } = buildCheckAnswersViewModel(
    request,
    {
      speciesCatalogue: catalogue,
      gearCatalogue,
      compactSummary: true
    }
  )

  return {
    pageTitle,
    heading: pageTitle,
    backLink: {
      href: backForCheckAnswers(request),
      text: 'Back'
    },
    sections,
    gearGroups,
    trailingSections
  }
}

export const checkAnswersController = {
  async handler(request, h) {
    const incomplete = incompleteGearPath(request)
    if (incomplete) {
      return h.redirect(incomplete).code(statusCodes.seeOther)
    }
    return h.view('check-answers/index', await viewContext(request))
  }
}

export const checkAnswersSubmitController = {
  handler(request, h) {
    const incomplete = incompleteGearPath(request)
    if (incomplete) {
      return h.redirect(incomplete).code(statusCodes.seeOther)
    }
    return h.redirect('/confirmation').code(303)
  }
}
