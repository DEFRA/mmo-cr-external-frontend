import Joi from 'joi'

import {
  getJourneyState,
  resolveNextPath,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import {
  findSpeciesOptionByLabel,
  getAvailableSpeciesIds,
  getSpeciesCatalogue
} from '#/server/common/helpers/species/species-list.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

const pageTitle = 'Add species to your vessel OLGA'

function speciesOptionLabels(availableSpeciesIds) {
  return getSpeciesCatalogue()
    .filter((species) => !availableSpeciesIds.includes(species.id))
    .map((species) => species.text)
}

function viewContext(request, overrides = {}) {
  const availableSpeciesIds = getAvailableSpeciesIds(getJourneyState(request))

  return {
    pageTitle,
    heading: pageTitle,
    caption: 'New catch record',
    backLink: {
      href: '/species-selection',
      text: 'Back'
    },
    speciesOptionLabels: speciesOptionLabels(availableSpeciesIds),
    ...overrides
  }
}

function renderError(request, h, errorText) {
  return h
    .view(
      'add-species/index',
      viewContext(request, {
        errorSummary: {
          titleText: 'There is a problem',
          errorList: [{ text: errorText, href: '#species' }]
        },
        fieldErrors: { species: errorText }
      })
    )
    .code(statusCodes.badRequest)
    .takeover()
}

export const addSpeciesController = {
  handler(request, h) {
    return h.view('add-species/index', viewContext(request))
  }
}

export const addSpeciesSubmitController = {
  options: {
    validate: {
      payload: Joi.object({
        species: Joi.string().allow('').optional()
      }),
      failAction(request, h) {
        return renderError(request, h, 'Enter the species you want to add')
      }
    }
  },
  handler(request, h) {
    const speciesLabel = (request.payload.species || '').trim()

    if (!speciesLabel) {
      return renderError(request, h, 'Enter the species you want to add')
    }

    const matchedSpecies = findSpeciesOptionByLabel(speciesLabel)

    if (!matchedSpecies) {
      return renderError(request, h, 'Select a species to add')
    }

    const journeyState = getJourneyState(request)
    const availableSpeciesIds = getAvailableSpeciesIds(journeyState)

    if (availableSpeciesIds.includes(matchedSpecies.id)) {
      return renderError(request, h, 'This species has already been added.')
    }

    setJourneyState(request, {
      availableSpeciesIds: [...availableSpeciesIds, matchedSpecies.id]
    })

    return h.redirect(resolveNextPath(request, '/species-selection')).code(303)
  }
}
