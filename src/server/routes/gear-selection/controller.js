import Joi from 'joi'

import {
  getJourneyState,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import { getData } from '#/server/common/data/get-data.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

const pageTitle = 'What gear did you use?'
const gearOptions = getData('gearSelection').sort(
  (a, b) => a.displayOrder - b.displayOrder
)
const validGearIds = gearOptions.map((option) => option.id)

function gearCheckboxItems(selectedGearIds) {
  return gearOptions.map((option) => ({
    value: option.id,
    text: option.label,
    hint: option.hint,
    checked: selectedGearIds.includes(option.id)
  }))
}

function viewContext(request, overrides = {}) {
  const journeyState = getJourneyState(request)
  const selectedGearIds = journeyState.selectedGearIds || []

  return {
    pageTitle,
    heading: pageTitle,
    backLink: {
      href: '/return-port',
      text: 'Back'
    },
    gearCheckboxItems: gearCheckboxItems(selectedGearIds),
    potsDetails: journeyState.potsDetails || {},
    ...overrides
  }
}

function normalizeGearIds(rawValue) {
  if (rawValue === undefined) {
    return []
  }

  return Array.isArray(rawValue) ? rawValue : [rawValue]
}

function renderWithErrors(
  request,
  h,
  { errorSummary, fieldErrors, selectedGearIds, potsDetails }
) {
  return h
    .view(
      'gear-selection/index',
      viewContext(request, {
        errorSummary,
        fieldErrors,
        ...(selectedGearIds && {
          gearCheckboxItems: gearCheckboxItems(selectedGearIds)
        }),
        ...(potsDetails && { potsDetails })
      })
    )
    .code(statusCodes.badRequest)
    .takeover()
}

function normalizePotsValue(rawValue) {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return { value: undefined, valid: false }
  }

  const numericValue = Number(rawValue)

  return {
    value: numericValue,
    valid: Number.isInteger(numericValue) && numericValue >= 0
  }
}

export const gearSelectionController = {
  handler(request, h) {
    return h.view('gear-selection/index', viewContext(request))
  }
}

export const gearSelectionSubmitController = {
  options: {
    validate: {
      payload: Joi.object({
        gearIds: Joi.alternatives()
          .try(
            Joi.array()
              .items(Joi.string().valid(...validGearIds))
              .min(1),
            Joi.string().valid(...validGearIds)
          )
          .required(),
        potsHauled: Joi.string().allow(''),
        potsInWater: Joi.string().allow('')
      }),
      failAction(request, h) {
        const errorText = 'Select the gear you used'

        return renderWithErrors(request, h, {
          errorSummary: {
            titleText: 'There is a problem',
            errorList: [{ text: errorText, href: '#gearIds' }]
          },
          fieldErrors: { gearIds: errorText },
          selectedGearIds: normalizeGearIds(request.payload.gearIds)
        })
      }
    }
  },
  handler(request, h) {
    const { gearIds: rawGearIds, potsHauled, potsInWater } = request.payload
    const gearIds = Array.isArray(rawGearIds) ? rawGearIds : [rawGearIds]
    const potsSelected = gearIds.includes('pots')

    if (potsSelected) {
      const hauled = normalizePotsValue(potsHauled)
      const inWater = normalizePotsValue(potsInWater)

      if (!hauled.valid || !inWater.valid) {
        const errorList = []
        const fieldErrors = {}

        if (!hauled.valid) {
          const errorText = 'Enter the total pots or traps hauled'
          errorList.push({ text: errorText, href: '#potsHauled' })
          fieldErrors.potsHauled = errorText
        }

        if (!inWater.valid) {
          const errorText = 'Enter the total pots or traps left in the water'
          errorList.push({ text: errorText, href: '#potsInWater' })
          fieldErrors.potsInWater = errorText
        }

        return renderWithErrors(request, h, {
          errorSummary: { titleText: 'There is a problem', errorList },
          fieldErrors,
          selectedGearIds: gearIds,
          potsDetails: { potsHauled, potsInWater }
        })
      }

      setJourneyState(request, {
        selectedGearIds: gearIds,
        potsDetails: { potsHauled: hauled.value, potsInWater: inWater.value }
      })
    } else {
      setJourneyState(request, {
        selectedGearIds: gearIds,
        potsDetails: undefined
      })
    }

    return h.redirect('/statistical-area').code(303)
  }
}
