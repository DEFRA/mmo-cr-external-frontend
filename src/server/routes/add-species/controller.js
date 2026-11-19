import { t } from '#/server/common/helpers/i18n/translator.js'

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
  const vesselName = getJourneyState(request).selectedVesselName || ''
  const heading = t('speciesSelection.addSpeciesToVessel')
  const pageTitle = vesselName
    ? t('speciesSelection.titleForVessel', { heading, vesselName })
    : heading
  return {
    pageTitle,
    heading,
    vesselName,
    caption:
      liveCatchRecords() &&
      (request.query.return === '/account' ||
        !getJourneyState(request).reference)
        ? t('common.yourFavourites')
        : catchRecordCaption(request),
    backLink: {
      href: speciesSelectionReturnPath(request),
      text: t('header.back')
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
          titleText: t('common.errorSummary.title'),
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
          t('speciesSelection.error.enterToAdd'),
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
        t('speciesSelection.error.enterToAdd'),
        speciesData
      )
    }

    const matchedSpecies = findSpeciesOptionByLabel(
      speciesLabel,
      speciesData.catalogue
    )

    if (!matchedSpecies) {
      return renderError(
        request,
        h,
        t('speciesSelection.error.selectToAdd'),
        speciesData
      )
    }

    if (existingSpeciesIds(request, speciesData).includes(matchedSpecies.id)) {
      return renderError(
        request,
        h,
        t('speciesSelection.error.alreadyAdded', {
          species: matchedSpecies.text
        }),
        speciesData
      )
    }

    await saveAddedSpecies(request, speciesData, matchedSpecies.id)

    return h
      .redirect(speciesSelectionReturnPath(request))
      .code(statusCodes.seeOther)
  }
}
