import Joi from 'joi'

import { statusCodes } from '#/server/common/constants/status-codes.js'
import { backForCheckAnswers } from '#/server/common/helpers/journey/navigation.js'
import { getSpeciesPageData } from '#/server/common/helpers/species/species-list.js'
import { getGearCatalogue } from '#/server/common/helpers/gear/favourite-gear.js'
import { buildCheckAnswersViewModel } from './view-model.js'

const pageTitle = 'Check your catch record'

async function viewContext(request, overrides = {}) {
  const { catalogue } = await getSpeciesPageData(request)
  const gearCatalogue = await getGearCatalogue()
  const { sections } = buildCheckAnswersViewModel(request, {
    speciesCatalogue: catalogue,
    gearCatalogue
  })

  return {
    pageTitle,
    heading: pageTitle,
    caption: 'New catch record',
    backLink: {
      href: backForCheckAnswers(request),
      text: 'Back'
    },
    sections,
    ...overrides
  }
}

export const checkAnswersController = {
  async handler(request, h) {
    return h.view('check-answers/index', await viewContext(request))
  }
}

export const checkAnswersSubmitController = {
  options: {
    validate: {
      payload: Joi.object({
        confirmAccurate: Joi.string().valid('true').required()
      }),
      async failAction(request, h) {
        const errorText =
          'Select I confirm the information is complete and accurate'

        return h
          .view(
            'check-answers/index',
            await viewContext(request, {
              errorSummary: {
                titleText: 'There is a problem',
                errorList: [{ text: errorText, href: '#confirmAccurate' }]
              },
              fieldErrors: { confirmAccurate: errorText }
            })
          )
          .code(statusCodes.badRequest)
          .takeover()
      }
    }
  },
  handler(_request, h) {
    return h.redirect('/confirmation').code(303)
  }
}
