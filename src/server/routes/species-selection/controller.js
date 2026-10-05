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

function isProvided(value) {
  return typeof value === 'string' && value.trim() !== ''
}

// Validates an optional weight field, skipping the check entirely when no value was entered.
function validateOptionalWeightField(rawValue, nameAndId, fieldLabel) {
  if (!isProvided(rawValue)) {
    return { result: { valid: true, reason: null }, errorText: null }
  }

  const result = validateWeight(rawValue)
  const errorText = result.valid
    ? null
    : weightErrorMessage(result.reason, nameAndId, fieldLabel)

  return { result, errorText }
}

// AC7/BR11: above-minimum weight must be strictly higher than legally-discarded weight.
function checkAboveMinimumHigherThanDiscarded(
  aboveMinimumResult,
  discardedResult,
  weights,
  nameAndId
) {
  const canCompare =
    aboveMinimumResult.valid &&
    isProvided(weights.weightDiscarded) &&
    discardedResult.valid

  if (!canCompare) {
    return null
  }

  const aboveMinimumValue = Number(weights.weightAboveMinimum.trim())
  const discardedValue = Number(weights.weightDiscarded.trim())

  if (aboveMinimumValue > discardedValue) {
    return null
  }

  return `Weight above minimum size retained must be higher than weight legally discarded for ${nameAndId}`
}

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

      const aboveMinimumResult = validateWeight(weights.weightAboveMinimum)

      if (!aboveMinimumResult.valid) {
        const errorText = weightErrorMessage(
          aboveMinimumResult.reason,
          nameAndId,
          'weight above minimum size retained'
        )
        errorList.push({
          text: errorText,
          href: `#weightAboveMinimum-${speciesId}`
        })
        speciesFieldErrors.weightAboveMinimum = errorText
      }

      const belowMinimum = validateOptionalWeightField(
        weights.weightBelowMinimum,
        nameAndId,
        'weight below minimum size retained'
      )

      if (belowMinimum.errorText) {
        errorList.push({
          text: belowMinimum.errorText,
          href: `#weightBelowMinimum-${speciesId}`
        })
        speciesFieldErrors.weightBelowMinimum = belowMinimum.errorText
      }

      const discarded = validateOptionalWeightField(
        weights.weightDiscarded,
        nameAndId,
        'weight legally discarded'
      )

      if (discarded.errorText) {
        errorList.push({
          text: discarded.errorText,
          href: `#weightDiscarded-${speciesId}`
        })
        speciesFieldErrors.weightDiscarded = discarded.errorText
      }

      const crossFieldErrorText = checkAboveMinimumHigherThanDiscarded(
        aboveMinimumResult,
        discarded.result,
        weights,
        nameAndId
      )

      if (crossFieldErrorText) {
        errorList.push({
          text: crossFieldErrorText,
          href: `#weightAboveMinimum-${speciesId}`
        })
        speciesFieldErrors.weightAboveMinimum = crossFieldErrorText
        speciesFieldErrors.weightDiscarded = crossFieldErrorText
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
