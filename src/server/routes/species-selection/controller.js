import Joi from 'joi'

import {
  backForSpeciesSelection,
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

const pageTitle = 'What species did you catch using pots?'

function speciesCheckboxItems(
  selectedSpeciesIds,
  speciesOptions,
  speciesWeights,
  fieldErrorsBySpecies
) {
  return speciesOptions.map((species) => {
    const weights = speciesWeights[species.id] || {}

    return {
      value: species.id,
      text: species.text,
      checked: selectedSpeciesIds.includes(species.id),
      // The below-minimum/legally-discarded sections are optional and revealed
      // client-side, but start expanded if they already hold a value (e.g. after
      // a validation failure or when restoring a previously-answered journey).
      weightFieldsVisible: {
        belowMinimum: Boolean(weights.weightBelowMinimum),
        legallyDiscarded: Boolean(weights.weightDiscarded)
      },
      weights,
      fieldErrors: fieldErrorsBySpecies[species.id] || {}
    }
  })
}

function viewContext(request, overrides = {}) {
  const journeyState = getJourneyState(request)
  const selectedSpeciesIds = journeyState.selectedSpeciesIds || []
  const speciesOptions = getSpeciesOptionsByIds(
    getAvailableSpeciesIds(journeyState)
  )
  const speciesWeights = journeyState.speciesWeights || {}

  return {
    pageTitle,
    heading: pageTitle,
    caption: 'New catch record',
    backLink: {
      href: backForSpeciesSelection(request),
      text: 'Back'
    },
    speciesCheckboxItems: speciesCheckboxItems(
      selectedSpeciesIds,
      speciesOptions,
      speciesWeights,
      {}
    ),
    ...overrides
  }
}

function renderPage(request, h, overrides, code = statusCodes.ok) {
  const response = h
    .view('species-selection/index', viewContext(request, overrides))
    .code(code)

  return code === statusCodes.ok ? response : response.takeover()
}

export const speciesSelectionController = {
  handler(request, h) {
    return h.view('species-selection/index', viewContext(request))
  }
}

export const speciesSelectionSubmitController = {
  options: {
    validate: {
      payload: Joi.object({
        speciesIds: Joi.alternatives()
          .try(Joi.array().items(Joi.string()), Joi.string())
          .allow('')
          .optional(),
        speciesAction: Joi.string().valid('continue').required()
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
              journeyState.speciesWeights || {},
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
    const speciesWeights = {}

    speciesOptions.forEach((species) => {
      speciesWeights[species.id] = {
        weightAboveMinimum: request.payload[`weightAboveMinimum-${species.id}`],
        weightBelowMinimum: request.payload[`weightBelowMinimum-${species.id}`],
        weightDiscarded: request.payload[`weightDiscarded-${species.id}`]
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
      return rerender(noSpeciesSelectedError(), statusCodes.badRequest)
    }

    const errorList = []
    const fieldErrorsBySpecies = {}

    speciesIds.forEach((speciesId) => {
      const speciesOption = speciesOptions.find(
        (option) => option.id === speciesId
      )
      const nameAndId = speciesNameAndId(speciesOption, speciesId)
      const weights = speciesWeights[speciesId] || {}
      const speciesFieldErrors = {}

      if (!isValidWeight(weights.weightAboveMinimum)) {
        const errorText = `Enter a weight for ${nameAndId}`
        errorList.push({
          text: errorText,
          href: `#weightAboveMinimum-${speciesId}`
        })
        speciesFieldErrors.weightAboveMinimum = errorText
      }

      if (
        weights.weightBelowMinimum &&
        !isValidWeight(weights.weightBelowMinimum)
      ) {
        const errorText = `Enter a weight below minimum size retained for ${nameAndId}`
        errorList.push({
          text: errorText,
          href: `#weightBelowMinimum-${speciesId}`
        })
        speciesFieldErrors.weightBelowMinimum = errorText
      }

      if (weights.weightDiscarded && !isValidWeight(weights.weightDiscarded)) {
        const errorText = `Enter a weight legally discarded for ${nameAndId}`
        errorList.push({
          text: errorText,
          href: `#weightDiscarded-${speciesId}`
        })
        speciesFieldErrors.weightDiscarded = errorText
      }

      if (Object.keys(speciesFieldErrors).length > 0) {
        fieldErrorsBySpecies[speciesId] = speciesFieldErrors
      }
    })

    if (errorList.length > 0) {
      return rerender(
        {
          errorSummary: { titleText: ERROR_SUMMARY_TITLE, errorList },
          fieldErrorsBySpecies
        },
        statusCodes.badRequest
      )
    }

    const persistedSpeciesWeights = {}

    speciesIds.forEach((speciesId) => {
      const weights = speciesWeights[speciesId] || {}

      persistedSpeciesWeights[speciesId] = {
        weightAboveMinimum: Number(weights.weightAboveMinimum),
        weightBelowMinimum: weights.weightBelowMinimum
          ? Number(weights.weightBelowMinimum)
          : undefined,
        weightDiscarded: weights.weightDiscarded
          ? Number(weights.weightDiscarded)
          : undefined
      }
    })

    setJourneyState(request, {
      selectedSpeciesIds: speciesIds,
      speciesWeights: persistedSpeciesWeights
    })

    return h
      .redirect(resolveNextPath(request, '/catch-not-landed'))
      .code(statusCodes.seeOther)
  }
}
