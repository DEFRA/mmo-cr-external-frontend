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

function viewContext(request, speciesData, overrides = {}) {
  const vesselName = liveCatchRecords()
    ? ''
    : getJourneyState(request).selectedVesselName || ''
  const heading = isCatchRecordJourney(request)
    ? 'Add species to your catch record'
    : liveCatchRecords()
      ? 'Add species to your favourites'
      : 'Add species to your vessel'
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

    const { availableSpeciesIds } = speciesData
    const state = getJourneyState(request)
    const existingIds = isCatchRecordJourney(request)
      ? [
          ...(state.journeySpeciesIds || []),
          ...(speciesData.journeyState.selectedSpeciesIds || [])
        ]
      : availableSpeciesIds

    if (existingIds.includes(matchedSpecies.id)) {
      return renderError(
        request,
        h,
        `${matchedSpecies.text} has already been added.`,
        speciesData
      )
    }

    if (isCatchRecordJourney(request)) {
      setJourneyState(request, {
        journeySpeciesIds: [
          ...new Set([...(state.journeySpeciesIds || []), matchedSpecies.id])
        ]
      })
    } else if (liveCatchRecords()) {
      await addFavouriteSpecies(request, matchedSpecies.id)
    } else {
      setJourneyState(request, {
        availableSpeciesIds: [...availableSpeciesIds, matchedSpecies.id]
      })
    }

    return h
      .redirect(speciesSelectionReturnPath(request))
      .code(statusCodes.seeOther)
  }
}
