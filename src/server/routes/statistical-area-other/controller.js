import Joi from 'joi'

import {
  getJourneyState,
  resolveNextPath,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import { getData } from '#/server/common/data/get-data.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import { offlineMapSubrectangles } from '#/server/common/data/offline-map-subrectangles.js'
import { offlineMapPorts } from '#/server/common/data/offline-map-ports.js'

const pageTitle =
  'Select the statistical sub area where the majority of your catch was caught using seine nets (mesh size 100mm)?'
const subrectangleFormat = /^\d{2}[A-Z]\d{2}$/i
const selectionErrorText = 'Select a statistical subrectangle'
const subrectangleFormatErrorText =
  'Enter a statistical subrectangle in the correct format, for example 38E84'
const subrectangleErrorText = 'Enter a valid statistical sub area code.'

function closestSubareas(portCoordinate) {
  return [...offlineMapSubrectangles.entries()]
    .toSorted(
      ([, first], [, second]) =>
        (first.coordinate[0] - portCoordinate[0]) ** 2 +
        (first.coordinate[1] - portCoordinate[1]) ** 2 -
        ((second.coordinate[0] - portCoordinate[0]) ** 2 +
          (second.coordinate[1] - portCoordinate[1]) ** 2)
    )
    .slice(0, 9)
    .map(([code]) => code)
}

function areaRadioItems(codes, selectedArea) {
  return [
    ...codes.map((code) => ({
      value: code,
      text: code,
      checked: code === selectedArea
    })),
    { value: 'other', text: 'Other', checked: selectedArea === 'other' }
  ]
}

function viewContext(request, overrides = {}) {
  const journeyState = getJourneyState(request)
  const alternativeStatisticalArea =
    journeyState.alternativeStatisticalArea || ''
  const departurePort = getData('ports').find(
    (port) => port.code === journeyState.departurePort
  )
  const nearbyAreaCodes = closestSubareas(
    offlineMapPorts.get((departurePort?.name || 'Hastings').toLowerCase())
  )
  const selectedArea = journeyState.selectedAlternativeAreaOption

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
    areaOptions: areaRadioItems(nearbyAreaCodes, selectedArea),
    selectedArea,
    alternativeStatisticalArea,
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
        statisticalArea: Joi.string().required(),
        alternativeStatisticalArea: Joi.string()
          .trim()
          .when('statisticalArea', {
            is: 'other',
            then: Joi.required(),
            otherwise: Joi.allow('')
          })
      }),
      failAction(request, h) {
        const isManualEntry = request.payload.statisticalArea === 'other'
        const errorText = isManualEntry ? subrectangleErrorText : selectionErrorText
        const errorField = isManualEntry
          ? 'alternativeStatisticalArea'
          : 'statisticalArea'
        const errorHref = isManualEntry
          ? '#alternativeStatisticalArea'
          : '#statisticalArea'

        return h
          .view(
            'statistical-area-other/index',
            viewContext(request, {
              errorSummary: {
                titleText: 'There is a problem',
                errorList: [{ text: errorText, href: errorHref }]
              },
              fieldErrors: { [errorField]: errorText },
              selectedArea: request.payload.statisticalArea,
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
    const { statisticalArea } = request.payload
    if (statisticalArea !== 'other') {
      if (!offlineMapSubrectangles.has(statisticalArea)) {
        return h.response().code(statusCodes.badRequest)
      }

      setJourneyState(request, {
        statAreaBranch: 'other',
        selectedAlternativeAreaOption: statisticalArea,
        alternativeStatisticalArea: undefined,
        alternativeStatisticalAreaCoordinates:
          offlineMapSubrectangles.get(statisticalArea).coordinate
      })

      return h
        .redirect(resolveNextPath(request, '/species-selection'))
        .code(303)
    }

    const submitted = request.payload.alternativeStatisticalArea
      .trim()
      .toUpperCase()

    if (!subrectangleFormat.test(submitted)) {
      return h
        .view(
          'statistical-area-other/index',
          viewContext(request, {
            errorSummary: {
              titleText: 'There is a problem',
              errorList: [
                {
                  text: subrectangleFormatErrorText,
                  href: '#alternativeStatisticalArea'
                }
              ]
            },
            fieldErrors: {
              alternativeStatisticalArea: subrectangleFormatErrorText
            },
            alternativeStatisticalArea: submitted
          })
        )
        .code(statusCodes.badRequest)
        .takeover()
    }

    const selectedSubrectangle = offlineMapSubrectangles.get(submitted)

    if (!selectedSubrectangle) {
      return h
        .view(
          'statistical-area-other/index',
          viewContext(request, {
            errorSummary: {
              titleText: 'There is a problem',
              errorList: [
                {
                  text: subrectangleErrorText,
                  href: '#alternativeStatisticalArea'
                }
              ]
            },
            fieldErrors: {
              alternativeStatisticalArea: subrectangleErrorText
            },
            alternativeStatisticalArea: submitted
          })
        )
        .code(statusCodes.badRequest)
        .takeover()
    }

    setJourneyState(request, {
      statAreaBranch: 'other',
      selectedAlternativeAreaOption: 'other',
      alternativeStatisticalArea: submitted,
      alternativeStatisticalAreaCoordinates: selectedSubrectangle.coordinate
    })

    return h.redirect(resolveNextPath(request, '/species-selection')).code(303)
  }
}
