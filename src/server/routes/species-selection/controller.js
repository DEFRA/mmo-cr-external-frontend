import Joi from 'joi'

import {
  backForSpeciesSelection,
  resolveNextPath,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import { getSpeciesPageData } from '#/server/common/helpers/species/species-list.js'
import { isValidWeight } from '#/server/common/helpers/species/weight-validation.js'
import {
  ERROR_SUMMARY_TITLE,
  filterKnownSpeciesIds,
  noSpeciesSelectedError,
  normalizeSpeciesIds,
  speciesNameAndId,
  speciesWeightFromPayload
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

function viewContext(request, speciesData, overrides = {}) {
  const { journeyState, speciesOptions } = speciesData
  const selectedSpeciesIds = journeyState.selectedSpeciesIds || []
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

function renderPage(request, h, speciesData, overrides, code = statusCodes.ok) {
  const response = h
    .view(
      'species-selection/index',
      viewContext(request, speciesData, overrides)
    )
    .code(code)

  return code === statusCodes.ok ? response : response.takeover()
}

export const speciesSelectionController = {
  async handler(request, h) {
    const speciesData = await getSpeciesPageData(request)
    return h.view('species-selection/index', viewContext(request, speciesData))
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
      async failAction(request, h) {
        const selectedSpeciesIds = normalizeSpeciesIds(
          request.payload.speciesIds
        )
        const speciesData = await getSpeciesPageData(request)
        const { journeyState, speciesOptions } = speciesData
        const errorText = 'There was a problem with your submission'

        return renderPage(
          request,
          h,
          speciesData,
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
  async handler(request, h) {
    const speciesData = await getSpeciesPageData(request)
    const { speciesOptions } = speciesData
    const speciesIds = filterKnownSpeciesIds(
      normalizeSpeciesIds(request.payload.speciesIds),
      speciesOptions
    )
    const speciesWeights = {}

    speciesOptions.forEach((species) => {
      speciesWeights[species.id] = {
        weightAboveMinimum: speciesWeightFromPayload(
          request.payload,
          'weightAboveMinimum',
          species
        ),
        weightBelowMinimum: speciesWeightFromPayload(
          request.payload,
          'weightBelowMinimum',
          species
        ),
        weightDiscarded: speciesWeightFromPayload(
          request.payload,
          'weightDiscarded',
          species
        )
      }
    })

    function rerender(extraOverrides, code = statusCodes.ok) {
      return renderPage(
        request,
        h,
        speciesData,
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
