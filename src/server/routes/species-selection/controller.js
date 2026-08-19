import Joi from 'joi'

import {
  backForSpeciesSelection,
  getJourneyState,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import { getData } from '#/server/common/data/get-data.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

const pageTitle = 'What species did you catch using pots?'
const speciesOptions = getData('speciesSelection')
const validSpeciesIds = speciesOptions.map((species) => species.id)

// Accepts 1-4 whole digits with an optional single decimal digit, e.g. 12, 12.3, 9999.9.
const WEIGHT_PATTERN = /^\d{1,4}(\.\d)?$/

function isValidWeight(rawValue) {
  if (!rawValue) {
    return false
  }

  const trimmedValue = rawValue.trim()

  if (!WEIGHT_PATTERN.test(trimmedValue)) {
    return false
  }

  const numericValue = Number(trimmedValue)

  return numericValue > 0 && numericValue <= 9999.9
}

function speciesCheckboxItems(selectedSpeciesIds) {
  return speciesOptions.map((species) => ({
    value: species.id,
    text: species.text,
    checked: selectedSpeciesIds.includes(species.id)
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
  const selectedSpeciesIds = journeyState.selectedSpeciesIds || []
  const weightFieldsVisible = journeyState.weightFieldsVisible || {
    belowMinimum: false,
    legallyDiscarded: false
  }
  const codWeights = journeyState.codWeights || {}

  return {
    pageTitle,
    heading: pageTitle,
    caption: 'New catch record',
    backLink: {
      href: backForSpeciesSelection(request),
      text: 'Back'
    },
    speciesCheckboxItems: speciesCheckboxItems(selectedSpeciesIds),
    codSelected: selectedSpeciesIds.includes('cod'),
    weightFieldsVisible,
    weights: {
      weightAboveMinimum: codWeights.weightAboveMinimum,
      weightBelowMinimum: codWeights.weightBelowMinimum,
      weightDiscarded: codWeights.weightDiscarded
    },
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
          .try(
            Joi.array().items(Joi.string().valid(...validSpeciesIds)),
            Joi.string().valid(...validSpeciesIds)
          )
          .allow('')
          .optional(),
        speciesAction: Joi.string()
          .valid(
            'continue',
            'add-below-minimum',
            'remove-below-minimum',
            'add-legally-discarded',
            'remove-legally-discarded'
          )
          .required(),
        weightAboveMinimum: Joi.string().allow(''),
        weightBelowMinimum: Joi.string().allow(''),
        weightDiscarded: Joi.string().allow(''),
        belowMinimumVisible: Joi.string().valid('true').optional(),
        legallyDiscardedVisible: Joi.string().valid('true').optional()
      }),
      failAction(request, h) {
        const selectedSpeciesIds = normalizeSpeciesIds(
          request.payload.speciesIds
        )
        const errorText = 'There was a problem with your submission'

        return renderPage(
          request,
          h,
          {
            speciesCheckboxItems: speciesCheckboxItems(selectedSpeciesIds),
            codSelected: selectedSpeciesIds.includes('cod'),
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
    const {
      speciesAction,
      weightAboveMinimum,
      weightBelowMinimum,
      weightDiscarded,
      belowMinimumVisible,
      legallyDiscardedVisible
    } = request.payload
    const speciesIds = normalizeSpeciesIds(request.payload.speciesIds)
    const codSelected = speciesIds.includes('cod')
    const weights = { weightAboveMinimum, weightBelowMinimum, weightDiscarded }
    const currentVisibility = {
      belowMinimum: belowMinimumVisible === 'true',
      legallyDiscarded: legallyDiscardedVisible === 'true'
    }

    if (speciesAction === 'add-below-minimum') {
      return renderPage(request, h, {
        speciesCheckboxItems: speciesCheckboxItems(speciesIds),
        codSelected,
        weightFieldsVisible: { ...currentVisibility, belowMinimum: true },
        weights
      })
    }

    if (speciesAction === 'remove-below-minimum') {
      return renderPage(request, h, {
        speciesCheckboxItems: speciesCheckboxItems(speciesIds),
        codSelected,
        weightFieldsVisible: { ...currentVisibility, belowMinimum: false },
        weights: { ...weights, weightBelowMinimum: '' }
      })
    }

    if (speciesAction === 'add-legally-discarded') {
      return renderPage(request, h, {
        speciesCheckboxItems: speciesCheckboxItems(speciesIds),
        codSelected,
        weightFieldsVisible: { ...currentVisibility, legallyDiscarded: true },
        weights
      })
    }

    if (speciesAction === 'remove-legally-discarded') {
      return renderPage(request, h, {
        speciesCheckboxItems: speciesCheckboxItems(speciesIds),
        codSelected,
        weightFieldsVisible: { ...currentVisibility, legallyDiscarded: false },
        weights: { ...weights, weightDiscarded: '' }
      })
    }

    // speciesAction === 'continue'
    if (speciesIds.length === 0) {
      const errorText = 'Select the species you caught'

      return renderPage(
        request,
        h,
        {
          speciesCheckboxItems: speciesCheckboxItems(speciesIds),
          codSelected,
          weightFieldsVisible: currentVisibility,
          weights,
          errorSummary: {
            titleText: 'There is a problem',
            errorList: [{ text: errorText, href: '#speciesIds' }]
          },
          fieldErrors: { speciesIds: errorText }
        },
        statusCodes.badRequest
      )
    }

    if (!codSelected) {
      return h.redirect('/not-implemented?return=/species-selection').code(303)
    }

    const errorList = []
    const fieldErrors = {}

    if (!isValidWeight(weightAboveMinimum)) {
      const errorText = 'Enter the weight above minimum size retained'
      errorList.push({ text: errorText, href: '#weightAboveMinimum' })
      fieldErrors.weightAboveMinimum = errorText
    }

    if (currentVisibility.belowMinimum && !isValidWeight(weightBelowMinimum)) {
      const errorText = 'Enter the weight below minimum size retained'
      errorList.push({ text: errorText, href: '#weightBelowMinimum' })
      fieldErrors.weightBelowMinimum = errorText
    }

    if (currentVisibility.legallyDiscarded && !isValidWeight(weightDiscarded)) {
      const errorText = 'Enter the weight legally discarded'
      errorList.push({ text: errorText, href: '#weightDiscarded' })
      fieldErrors.weightDiscarded = errorText
    }

    if (errorList.length > 0) {
      return renderPage(
        request,
        h,
        {
          speciesCheckboxItems: speciesCheckboxItems(speciesIds),
          codSelected,
          weightFieldsVisible: currentVisibility,
          weights,
          errorSummary: { titleText: 'There is a problem', errorList },
          fieldErrors
        },
        statusCodes.badRequest
      )
    }

    setJourneyState(request, {
      selectedSpeciesIds: speciesIds,
      codWeights: {
        weightAboveMinimum: Number(weightAboveMinimum),
        weightBelowMinimum: currentVisibility.belowMinimum
          ? Number(weightBelowMinimum)
          : undefined,
        weightDiscarded: currentVisibility.legallyDiscarded
          ? Number(weightDiscarded)
          : undefined
      },
      weightFieldsVisible: currentVisibility
    })

    return h.redirect('/catch-not-landed').code(303)
  }
}
