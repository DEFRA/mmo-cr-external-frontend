import Joi from 'joi'

import {
  getJourneyState,
  resolveNextPath,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import { getData } from '#/server/common/data/get-data.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

const pageTitle = 'Where was most of your catch caught using pots?'
const AREA_FORMAT = /^\d{2}[A-Z]\d{2}$/i
const statisticalAreas = getData('statisticalAreas').sort(
  (a, b) => a.displayOrder - b.displayOrder
)
const validAreaIds = [...statisticalAreas.map((area) => area.id), 'other']

function areaRadioItems(selectedValue) {
  return [
    ...statisticalAreas.map((area) => ({
      value: area.id,
      text: area.code,
      checked: area.id === selectedValue
    })),
    { value: 'other', text: 'Other', checked: selectedValue === 'other' }
  ]
}

function viewContext(request, overrides = {}) {
  const journeyState = getJourneyState(request)
  const selectedArea = journeyState.selectedAlternativeAreaOption || 'other'

  return {
    pageTitle,
    heading: pageTitle,
    caption: 'New catch record',
    bodyText: [
      'The statistical areas nearest to your departure port are shown below. Select the area where most of your catch was caught.',
      "If it is not listed, select 'Other' to enter it."
    ],
    backLink: {
      href: '/statistical-area',
      text: 'Back'
    },
    areaOptions: areaRadioItems(selectedArea),
    selectedArea,
    showAlternativeInput: selectedArea === 'other',
    alternativeStatisticalArea: journeyState.alternativeStatisticalArea || '',
    ...overrides
  }
}

export const statisticalAreaOtherController = {
  handler(request, h) {
    return h.view('statistical-area-other/index', viewContext(request))
  }
}

export const statisticalAreaOtherSubmitController = {
  options: {
    validate: {
      payload: Joi.object({
        statisticalArea: Joi.string()
          .valid(...validAreaIds)
          .required(),
        alternativeStatisticalArea: Joi.string().trim().allow('')
      }),
      failAction(request, h) {
        const errorText = 'Select the area where most of your catch was caught'

        return h
          .view(
            'statistical-area-other/index',
            viewContext(request, {
              errorSummary: {
                titleText: 'There is a problem',
                errorList: [{ text: errorText, href: '#statisticalArea' }]
              },
              fieldErrors: { statisticalArea: errorText },
              areaOptions: areaRadioItems(request.payload.statisticalArea),
              selectedArea: request.payload.statisticalArea,
              showAlternativeInput: request.payload.statisticalArea === 'other',
              alternativeStatisticalArea:
                request.payload.alternativeStatisticalArea
            })
          )
          .code(statusCodes.badRequest)
          .takeover()
      }
    }
  },
  handler(request, h) {
    const { statisticalArea, alternativeStatisticalArea } = request.payload

    if (statisticalArea !== 'other') {
      setJourneyState(request, {
        statAreaBranch: 'other',
        selectedAlternativeAreaOption: statisticalArea,
        alternativeStatisticalArea: undefined
      })

      return h
        .redirect(resolveNextPath(request, '/species-selection'))
        .code(303)
    }

    const submitted = alternativeStatisticalArea

    if (!AREA_FORMAT.test(submitted)) {
      return h
        .view(
          'statistical-area-other/index',
          viewContext(request, {
            errorSummary: {
              titleText: 'There is a problem',
              errorList: [
                {
                  text: 'Enter the statistical sub area in the correct format, like 46E45',
                  href: '#alternativeStatisticalArea'
                }
              ]
            },
            fieldErrors: {
              alternativeStatisticalArea:
                'Enter the statistical sub area in the correct format, like 46E45'
            },
            areaOptions: areaRadioItems('other'),
            selectedArea: 'other',
            showAlternativeInput: true,
            alternativeStatisticalArea: submitted
          })
        )
        .code(statusCodes.badRequest)
        .takeover()
    }

    setJourneyState(request, {
      statAreaBranch: 'other',
      selectedAlternativeAreaOption: 'other',
      alternativeStatisticalArea: submitted.trim().toUpperCase()
    })

    return h.redirect(resolveNextPath(request, '/species-selection')).code(303)
  }
}
