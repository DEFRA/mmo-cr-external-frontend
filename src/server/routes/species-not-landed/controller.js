import Joi from 'joi'

import {
  getJourneyState,
  resolveNextPath,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import {
  getAvailableSpeciesIds,
  getSpeciesOptionsByIds
} from '#/server/common/helpers/species/species-list.js'
import { isValidWeight } from '#/server/common/helpers/species/weight-validation.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

const pageTitle =
  'Which species from this trip are you not landing straight away?'

// Strips the trailing " (CODE)" suffix, e.g. "Atlantic cod (COD)" -> "Atlantic cod".
function speciesNameOnly(text) {
  return text.replace(/ \([^)]*\)$/, '')
}

function speciesCheckboxItems(
  selectedSpeciesIds,
  speciesOptions,
  speciesWeights,
  fieldErrorsBySpecies
) {
  return speciesOptions.map((species) => ({
    value: species.id,
    text: species.text,
    checked: selectedSpeciesIds.includes(species.id),
    weights: speciesWeights[species.id] || {},
    fieldErrors: fieldErrorsBySpecies[species.id] || {}
  }))
}

function normalizeSpeciesIds(rawValue) {
  if (rawValue === undefined || rawValue === '') {
    return []
  }

  return Array.isArray(rawValue) ? rawValue : [rawValue]
}

function viewContext(request, overrides = {}) {
  const journeyState = getJourneyState(request)
  const speciesNotLanded = journeyState.speciesNotLanded || {}
  const selectedSpeciesIds = Object.keys(speciesNotLanded)
  const speciesOptions = getSpeciesOptionsByIds(
    getAvailableSpeciesIds(journeyState)
  )

  return {
    pageTitle,
    heading: pageTitle,
    caption: 'New catch record',
    backLink: {
      href: '/catch-not-landed',
      text: 'Back'
    },
    speciesCheckboxItems: speciesCheckboxItems(
      selectedSpeciesIds,
      speciesOptions,
      speciesNotLanded,
      {}
    ),
    ...overrides
  }
}

function renderPage(request, h, overrides, code = statusCodes.ok) {
  const response = h
    .view('species-not-landed/index', viewContext(request, overrides))
    .code(code)

  return code === statusCodes.ok ? response : response.takeover()
}

export const speciesNotLandedController = {
  handler(request, h) {
    return h.view('species-not-landed/index', viewContext(request))
  }
}

export const speciesNotLandedSubmitController = {
  options: {
    validate: {
      payload: Joi.object({
        speciesIds: Joi.alternatives()
          .try(Joi.array().items(Joi.string()), Joi.string())
          .allow('')
          .optional()
      }).unknown(true),
      failAction(request, h) {
        const selectedSpeciesIds = normalizeSpeciesIds(
          request.payload.speciesIds
        )
        const journeyState = getJourneyState(request)
        const speciesOptions = getSpeciesOptionsByIds(
          getAvailableSpeciesIds(journeyState)
        )
        const errorText = 'There was a problem with your submission'

        return renderPage(
          request,
          h,
          {
            speciesCheckboxItems: speciesCheckboxItems(
              selectedSpeciesIds,
              speciesOptions,
              journeyState.speciesNotLanded || {},
              {}
            ),
            errorSummary: {
              titleText: 'There is a problem',
              errorList: [{ text: errorText, href: '#speciesIds' }]
            }
          },
          statusCodes.badRequest
        )
      }
    }
  },
  handler(request, h) {
    const speciesIds = normalizeSpeciesIds(request.payload.speciesIds)
    const journeyState = getJourneyState(request)
    const speciesOptions = getSpeciesOptionsByIds(
      getAvailableSpeciesIds(journeyState)
    )
    const speciesWeights = {}

    speciesOptions.forEach((species) => {
      speciesWeights[species.id] = {
        weightAboveMinimum: request.payload[`weightAboveMinimum-${species.id}`]
      }
    })

    function rerender(extraOverrides, code = statusCodes.ok) {
      return renderPage(
        request,
        h,
        {
          speciesCheckboxItems: speciesCheckboxItems(
            speciesIds,
            speciesOptions,
            speciesWeights,
            extraOverrides.fieldErrorsBySpecies || {}
          ),
          ...extraOverrides
        },
        code
      )
    }

    if (speciesIds.length === 0) {
      const errorText = 'Select at least one species'

      return rerender(
        {
          errorSummary: {
            titleText: 'There is a problem',
            errorList: [{ text: errorText, href: '#speciesIds' }]
          },
          fieldErrors: { speciesIds: errorText }
        },
        statusCodes.badRequest
      )
    }

    const errorList = []
    const fieldErrorsBySpecies = {}

    speciesIds.forEach((speciesId) => {
      const speciesOption = speciesOptions.find(
        (option) => option.id === speciesId
      )
      const nameAndId = `${speciesNameOnly(speciesOption.text).toLowerCase()} (${speciesId})`
      const weights = speciesWeights[speciesId] || {}

      if (!isValidWeight(weights.weightAboveMinimum)) {
        const errorText = `Enter a weight for ${nameAndId}`
        errorList.push({
          text: errorText,
          href: `#weightAboveMinimum-${speciesId}`
        })
        fieldErrorsBySpecies[speciesId] = { weightAboveMinimum: errorText }
      }
    })

    if (errorList.length > 0) {
      return rerender(
        {
          errorSummary: { titleText: 'There is a problem', errorList },
          fieldErrorsBySpecies
        },
        statusCodes.badRequest
      )
    }

    const persistedSpeciesNotLanded = {}

    speciesIds.forEach((speciesId) => {
      persistedSpeciesNotLanded[speciesId] = {
        weightAboveMinimum: Number(speciesWeights[speciesId].weightAboveMinimum)
      }
    })

    setJourneyState(request, { speciesNotLanded: persistedSpeciesNotLanded })

    return h.redirect(resolveNextPath(request, '/check-answers')).code(303)
  }
}
