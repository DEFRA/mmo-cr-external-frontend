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
import { config } from '#/config/config.js'
import { createMapStatisticalAreasReferenceDataClient } from '#/server/common/clients/map-statistical-areas-reference-data.js'

const pageTitle =
  'Select the statistical sub area where the majority of your catch was caught using seine nets (mesh size 100mm)?'
const subrectangleFormat = /^\d{2}[A-Z]\d{2}$/i
const selectionErrorText = 'Select a statistical subrectangle'
const subrectangleFormatErrorText =
  'Enter a statistical subrectangle in the correct format, for example 38E84'
const subrectangleErrorText = 'Enter a valid statistical sub area code.'
const errorSummaryTitle = 'There is a problem'
const alternativeStatisticalAreaHref = '#alternativeStatisticalArea'
const nearbyAreaCount = 9
const statisticalAreasClient = createMapStatisticalAreasReferenceDataClient({
  serviceUrl: config.get('referenceData.serviceUrl'),
  token: () => config.get('referenceData.token'),
  timeoutMs: config.get('referenceData.timeoutMs')
})

async function apiSubrectangle(code) {
  try {
    const result = await statisticalAreasClient.getCollection({ code })
    const match = result.body.features.find(
      (feature) => feature.properties.code.toUpperCase() === code.toUpperCase()
    )
    if (!match) {
      return undefined
    }
    const { feature } = await statisticalAreasClient.getFeature(match.id)
    const centroid = feature.properties.centroid
    return centroid ? [centroid.longitude, centroid.latitude] : undefined
  } catch {
    return undefined
  }
}

function closestSubareas(portCoordinate) {
  return [...offlineMapSubrectangles.entries()]
    .toSorted(
      ([, first], [, second]) =>
        (first.coordinate[0] - portCoordinate[0]) ** 2 +
        (first.coordinate[1] - portCoordinate[1]) ** 2 -
        ((second.coordinate[0] - portCoordinate[0]) ** 2 +
          (second.coordinate[1] - portCoordinate[1]) ** 2)
    )
    .slice(0, nearbyAreaCount)
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

function formatCoordinate([longitude, latitude]) {
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
}

function resolveSelectedAreaCoordinatesText(
  selectedArea,
  alternativeStatisticalArea
) {
  const code =
    selectedArea === 'other'
      ? alternativeStatisticalArea?.toUpperCase()
      : selectedArea

  if (!code) {
    return undefined
  }

  const subrectangle = offlineMapSubrectangles.get(code)
  return subrectangle ? formatCoordinate(subrectangle.coordinate) : undefined
}

function viewContext(request, overrides = {}) {
  const journeyState = getJourneyState(request)
  const alternativeStatisticalArea =
    journeyState.alternativeStatisticalArea || ''
  const departurePort = getData('ports').find(
    (port) => port.code === journeyState.departurePort
  )
  const departurePortName =
    journeyState.portNamesByCode?.[journeyState.departurePort] ||
    departurePort?.name ||
    'Hastings'
  const departurePortCoordinate =
    journeyState.portCoordinatesByCode?.[journeyState.departurePort] ||
    (departurePortName
      ? offlineMapPorts.get(departurePortName.toLowerCase())
      : undefined)
  const nearbyAreaCodes = departurePortCoordinate
    ? closestSubareas(departurePortCoordinate)
    : []
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
    selectedAreaCoordinatesText: resolveSelectedAreaCoordinatesText(
      selectedArea,
      alternativeStatisticalArea
    ),
    ...overrides
  }
}

export const statisticalAreaOtherController = {
  handler(request, h) {
    return h.view('statistical-area-other/index', viewContext(request))
  }
}

async function handleKnownAreaSelection(request, h, statisticalArea) {
  const apiCoordinate = await apiSubrectangle(statisticalArea)
  const offlineArea = offlineMapSubrectangles.get(statisticalArea)
  const coordinate = apiCoordinate || offlineArea?.coordinate
  if (!coordinate) {
    return h.response().code(statusCodes.badRequest)
  }

  setJourneyState(request, {
    statAreaBranch: 'other',
    selectedAlternativeAreaOption: statisticalArea,
    alternativeStatisticalArea: null,
    alternativeStatisticalAreaCoordinates: coordinate
  })

  return h
    .redirect(resolveNextPath(request, '/species-selection'))
    .code(statusCodes.seeOther)
}

async function handleManualAreaSubmission(request, h) {
  const submitted = request.payload.alternativeStatisticalArea
    .trim()
    .toUpperCase()

  if (!subrectangleFormat.test(submitted)) {
    return h
      .view(
        'statistical-area-other/index',
        viewContext(request, {
          errorSummary: {
            titleText: errorSummaryTitle,
            errorList: [
              {
                text: subrectangleFormatErrorText,
                href: alternativeStatisticalAreaHref
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

  const apiCoordinate = await apiSubrectangle(submitted)
  const selectedSubrectangle = offlineMapSubrectangles.get(submitted)
  const coordinate = apiCoordinate || selectedSubrectangle?.coordinate

  if (!coordinate) {
    return h
      .view(
        'statistical-area-other/index',
        viewContext(request, {
          errorSummary: {
            titleText: errorSummaryTitle,
            errorList: [
              {
                text: subrectangleErrorText,
                href: alternativeStatisticalAreaHref
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
    alternativeStatisticalAreaCoordinates: coordinate
  })

  return h
    .redirect(resolveNextPath(request, '/species-selection'))
    .code(statusCodes.seeOther)
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
        const errorText = isManualEntry
          ? subrectangleErrorText
          : selectionErrorText
        const errorField = isManualEntry
          ? 'alternativeStatisticalArea'
          : 'statisticalArea'
        const errorHref = isManualEntry
          ? alternativeStatisticalAreaHref
          : '#statisticalArea'

        return h
          .view(
            'statistical-area-other/index',
            viewContext(request, {
              errorSummary: {
                titleText: errorSummaryTitle,
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
  async handler(request, h) {
    const { statisticalArea } = request.payload
    if (statisticalArea !== 'other') {
      return handleKnownAreaSelection(request, h, statisticalArea)
    }
    return handleManualAreaSubmission(request, h)
  }
}
