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
import {
  ERROR_SUMMARY_TITLE,
  filterKnownSpeciesIds,
  noSpeciesSelectedError,
  normalizeSpeciesIds,
  speciesNameAndId
} from '#/server/common/helpers/species/species-form.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

const pageTitle =
  'Which species from this trip are you not landing straight away?'

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

function buildSpeciesWeightsFromPayload(payload, speciesOptions) {
  const speciesWeights = {}

  speciesOptions.forEach((species) => {
    speciesWeights[species.id] = {
      weightAboveMinimum: payload[`weightAboveMinimum-${species.id}`]
    }
  })

  return speciesWeights
}

function validateSpeciesNotLandedWeights(
  speciesIds,
  speciesOptions,
  speciesWeights
) {
  const errorList = []
  const fieldErrorsBySpecies = {}

  speciesIds.forEach((speciesId) => {
    const speciesOption = speciesOptions.find(
      (option) => option.id === speciesId
    )
    const nameAndId = speciesNameAndId(speciesOption, speciesId)
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

  return { errorList, fieldErrorsBySpecies }
}

function persistSpeciesNotLanded(request, speciesIds, speciesWeights) {
  const persistedSpeciesNotLanded = {}

  speciesIds.forEach((speciesId) => {
    persistedSpeciesNotLanded[speciesId] = {
      weightAboveMinimum: Number(speciesWeights[speciesId].weightAboveMinimum)
    }
  })

  setJourneyState(request, { speciesNotLanded: persistedSpeciesNotLanded })
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
              titleText: ERROR_SUMMARY_TITLE,
              errorList: [{ text: errorText, href: '#speciesIds' }]
            }
          },
          statusCodes.badRequest
        )
      }
    }
  },
  handler(request, h) {
    const journeyState = getJourneyState(request)
    const speciesOptions = getSpeciesOptionsByIds(
      getAvailableSpeciesIds(journeyState)
    )
    const speciesIds = filterKnownSpeciesIds(
      normalizeSpeciesIds(request.payload.speciesIds),
      speciesOptions
    )
    const speciesWeights = buildSpeciesWeightsFromPayload(
      request.payload,
      speciesOptions
    )

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
      return rerender(noSpeciesSelectedError(), statusCodes.badRequest)
    }

    const { errorList, fieldErrorsBySpecies } = validateSpeciesNotLandedWeights(
      speciesIds,
      speciesOptions,
      speciesWeights
    )

    if (errorList.length > 0) {
      return rerender(
        {
          errorSummary: { titleText: ERROR_SUMMARY_TITLE, errorList },
          fieldErrorsBySpecies
        },
        statusCodes.badRequest
      )
    }

    persistSpeciesNotLanded(request, speciesIds, speciesWeights)

    return h
      .redirect(resolveNextPath(request, '/check-answers'))
      .code(statusCodes.seeOther)
  }
}
