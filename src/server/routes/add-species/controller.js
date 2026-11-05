import Joi from 'joi'

import {
  catchRecordCaption,
  getJourneyState,
  isCatchRecordJourney,
  speciesSelectionReturnPath,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import {
  findSpeciesOptionByLabel,
  getSpeciesPageData
} from '#/server/common/helpers/species/species-list.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import { addFavouriteSpecies } from '#/server/common/helpers/journey/session-favourites.js'
import { liveCatchRecords } from '#/server/common/helpers/journey/catch-record-service.js'

function addSpeciesHeading(request) {
  if (isCatchRecordJourney(request)) {
    return 'Add species to your catch record'
  }
  return liveCatchRecords()
    ? 'Add species to your favourites'
    : 'Add species to your vessel'
}

function viewContext(request, speciesData, overrides = {}) {
  const vesselName = liveCatchRecords()
    ? ''
    : getJourneyState(request).selectedVesselName || ''
  const heading = addSpeciesHeading(request)
  const pageTitle = vesselName ? `${heading} ${vesselName}` : heading
  return {
    pageTitle,
    heading,
    vesselName,
    caption:
      liveCatchRecords() &&
      (request.query.return === '/account' ||
        !getJourneyState(request).reference)
        ? 'Your favourites'
        : catchRecordCaption(request),
    backLink: {
      href: speciesSelectionReturnPath(request),
      text: 'Back'
    },
    speciesOptionLabels: speciesData.catalogue.map((species) => species.text),
    ...overrides
  }
}

async function renderError(request, h, errorText, speciesData) {
  const data = speciesData || (await getSpeciesPageData(request))
  return h
    .view(
      'add-species/index',
      viewContext(request, data, {
        errorSummary: {
          titleText: 'There is a problem',
          errorList: [{ text: errorText, href: '#species' }]
        },
        fieldErrors: { species: errorText }
      })
    )
    .code(statusCodes.badRequest)
    .takeover()
}

export const addSpeciesController = {
  async handler(request, h) {
    const speciesData = await getSpeciesPageData(request, {
      loadFavourites: true
    })
    return h.view('add-species/index', viewContext(request, speciesData))
  }
}

function existingSpeciesIds(request, speciesData) {
  if (!isCatchRecordJourney(request)) {
    return speciesData.availableSpeciesIds
  }
  return [
    ...(getJourneyState(request).journeySpeciesIds || []),
    ...(speciesData.journeyState.selectedSpeciesIds || [])
  ]
}

async function saveAddedSpecies(request, speciesData, speciesId) {
  if (isCatchRecordJourney(request)) {
    const { journeySpeciesIds = [] } = getJourneyState(request)
    setJourneyState(request, {
      journeySpeciesIds: [...new Set([...journeySpeciesIds, speciesId])]
    })
  } else if (liveCatchRecords()) {
    await addFavouriteSpecies(request, speciesId)
  } else {
    setJourneyState(request, {
      availableSpeciesIds: [...speciesData.availableSpeciesIds, speciesId]
    })
  }
}

export const addSpeciesSubmitController = {
  options: {
    validate: {
      payload: Joi.object({
        species: Joi.string().allow('').optional()
      }),
      async failAction(request, h) {
        const speciesData = await getSpeciesPageData(request, {
          loadFavourites: true
        })
        return renderError(
          request,
          h,
          'Enter the species you want to add',
          speciesData
        )
      }
    }
  },
  async handler(request, h) {
    const speciesData = await getSpeciesPageData(request, {
      loadFavourites: true
    })
    const speciesLabel = (request.payload.species || '').trim()

    if (!speciesLabel) {
      return renderError(
        request,
        h,
        'Enter the species you want to add',
        speciesData
      )
    }

    const matchedSpecies = findSpeciesOptionByLabel(
      speciesLabel,
      speciesData.catalogue
    )

    if (!matchedSpecies) {
      return renderError(request, h, 'Select a species to add', speciesData)
    }

    if (existingSpeciesIds(request, speciesData).includes(matchedSpecies.id)) {
      return renderError(
        request,
        h,
        `${matchedSpecies.text} has already been added.`,
        speciesData
      )
    }

    await saveAddedSpecies(request, speciesData, matchedSpecies.id)

    return h
      .redirect(speciesSelectionReturnPath(request))
      .code(statusCodes.seeOther)
  }
}
