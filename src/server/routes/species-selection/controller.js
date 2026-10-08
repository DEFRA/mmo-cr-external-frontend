import Joi from 'joi'

import {
  backForSpeciesSelection,
  resolveNextPath,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import { getSpeciesPageData } from '#/server/common/helpers/species/species-list.js'
import {
  validateWeight,
  weightErrorMessage
} from '#/server/common/helpers/species/weight-validation.js'
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

function validateWeightField(
  rawValue,
  nameAndId,
  fieldLabel,
  fieldName,
  speciesId,
  required = false
) {
  if (!required && !isProvided(rawValue)) {
    return { result: { valid: true, reason: null }, errorText: null }
  }

  const result = validateWeight(rawValue)
  const errorText = result.valid
    ? null
    : weightErrorMessage(result.reason, nameAndId, fieldLabel)

  return {
    fieldName,
    result,
    errorText,
    errorItem: errorText
      ? { text: errorText, href: `#${fieldName}-${speciesId}` }
      : null
  }
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

function speciesWeightsFromPayload(payload, speciesOptions) {
  return Object.fromEntries(
    speciesOptions.map((species) => [
      species.id,
      {
        weightAboveMinimum: speciesWeightFromPayload(
          payload,
          'weightAboveMinimum',
          species
        ),
        weightBelowMinimum: speciesWeightFromPayload(
          payload,
          'weightBelowMinimum',
          species
        ),
        weightDiscarded: speciesWeightFromPayload(
          payload,
          'weightDiscarded',
          species
        )
      }
    ])
  )
}

function validateSpeciesWeightFields(speciesId, speciesOption, weights) {
  const nameAndId = speciesNameAndId(speciesOption, speciesId)
  const validations = [
    validateWeightField(
      weights.weightAboveMinimum,
      nameAndId,
      'weight above minimum size retained',
      'weightAboveMinimum',
      speciesId,
      true
    ),
    validateWeightField(
      weights.weightBelowMinimum,
      nameAndId,
      'weight below minimum size retained',
      'weightBelowMinimum',
      speciesId
    ),
    validateWeightField(
      weights.weightDiscarded,
      nameAndId,
      'weight legally discarded',
      'weightDiscarded',
      speciesId
    )
  ]
  const errorList = validations
    .map((validation) => validation.errorItem)
    .filter(Boolean)
  const fieldErrors = Object.fromEntries(
    validations
      .filter((validation) => validation.errorText)
      .map((validation) => [validation.fieldName, validation.errorText])
  )
  const crossFieldErrorText = checkAboveMinimumHigherThanDiscarded(
    validations[0].result,
    validations[2].result,
    weights,
    nameAndId
  )

  if (crossFieldErrorText) {
    errorList.push({
      text: crossFieldErrorText,
      href: `#weightAboveMinimum-${speciesId}`
    })
    fieldErrors.weightAboveMinimum = crossFieldErrorText
    fieldErrors.weightDiscarded = crossFieldErrorText
  }

  return { errorList, fieldErrors }
}

function validateSpeciesWeights(speciesIds, speciesOptions, speciesWeights) {
  const result = { errorList: [], fieldErrorsBySpecies: {} }

  for (const speciesId of speciesIds) {
    const speciesOption = speciesOptions.find(
      (option) => option.id === speciesId
    )
    const validation = validateSpeciesWeightFields(
      speciesId,
      speciesOption,
      speciesWeights[speciesId] || {}
    )
    result.errorList.push(...validation.errorList)
    if (Object.keys(validation.fieldErrors).length > 0) {
      result.fieldErrorsBySpecies[speciesId] = validation.fieldErrors
    }
  }

  return result
}

function persistedSpeciesWeights(speciesIds, speciesWeights) {
  return Object.fromEntries(
    speciesIds.map((speciesId) => {
      const weights = speciesWeights[speciesId] || {}
      return [
        speciesId,
        {
          weightAboveMinimum: Number(weights.weightAboveMinimum),
          weightBelowMinimum: weights.weightBelowMinimum
            ? Number(weights.weightBelowMinimum)
            : undefined,
          weightDiscarded: weights.weightDiscarded
            ? Number(weights.weightDiscarded)
            : undefined
        }
      ]
    })
  )
}

function renderSelectionError(
  request,
  h,
  speciesData,
  speciesIds,
  speciesWeights,
  overrides
) {
  return renderPage(
    request,
    h,
    speciesData,
    {
      speciesCheckboxItems: speciesCheckboxItems(
        speciesIds,
        speciesData.speciesOptions,
        speciesWeights,
        overrides.fieldErrorsBySpecies || {}
      ),
      ...overrides
    },
    statusCodes.badRequest
  )
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
    const speciesWeights = speciesWeightsFromPayload(
      request.payload,
      speciesOptions
    )

    if (speciesIds.length === 0) {
      return renderSelectionError(
        request,
        h,
        speciesData,
        speciesIds,
        speciesWeights,
        noSpeciesSelectedError()
      )
    }

    const { errorList, fieldErrorsBySpecies } = validateSpeciesWeights(
      speciesIds,
      speciesOptions,
      speciesWeights
    )

    if (errorList.length > 0) {
      return renderSelectionError(
        request,
        h,
        speciesData,
        speciesIds,
        speciesWeights,
        {
          errorSummary: { titleText: ERROR_SUMMARY_TITLE, errorList },
          fieldErrorsBySpecies
        }
      )
    }

    setJourneyState(request, {
      selectedSpeciesIds: speciesIds,
      speciesWeights: persistedSpeciesWeights(speciesIds, speciesWeights)
    })

    return h
      .redirect(resolveNextPath(request, '/catch-not-landed'))
      .code(statusCodes.seeOther)
  }
}
