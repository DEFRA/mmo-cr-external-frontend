import { t } from '#/server/common/helpers/i18n/translator.js'

import {
  isCatchRecordJourney,
  resolveNextPath,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import {
  getFavouriteGearIds,
  getFavouriteGearOptions,
  getGearCatalogue,
  migrateGearJourneyState
} from '#/server/common/helpers/gear/favourite-gear.js'
import { getData } from '#/server/common/data/get-data.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import { liveCatchRecords } from '#/server/common/helpers/journey/catch-record-service.js'
import {
  loadFavouriteGears,
  removeFavouriteGears
} from '#/server/common/helpers/journey/session-favourites.js'

const GEAR_SELECTION_PATH = '/gear-selection'

function gearCheckboxItems(favouriteOptions) {
  return favouriteOptions.map((option) => ({
    value: option.id,
    text: option.label,
    hint: option.hint
  }))
}

// During a live trip the gear selection page also lists trip-only and saved
// record gear, so the remove page must offer the same set.
function removableGearIds(request, journeyState, catalogue) {
  const favouriteGearIds = getFavouriteGearIds(journeyState, catalogue)
  if (!isCatchRecordJourney(request)) {
    return favouriteGearIds
  }
  return [
    ...new Set([
      ...favouriteGearIds,
      ...(journeyState.journeyGearIds || []),
      ...(journeyState.selectedGearIds || [])
    ])
  ]
}

function remainingTripGearState(journeyState, idsToRemove) {
  const keep = (id) => !idsToRemove.includes(id)
  const remainingSelectedGearIds = (journeyState.selectedGearIds || []).filter(
    keep
  )
  const keepSelected = ([id]) => remainingSelectedGearIds.includes(id)
  return {
    selectedGearIds: remainingSelectedGearIds,
    catchDetailsByGearId: Object.fromEntries(
      Object.entries(journeyState.catchDetailsByGearId || {}).filter(
        keepSelected
      )
    ),
    gearMeasurementDetails: Object.fromEntries(
      Object.entries(journeyState.gearMeasurementDetails || {}).filter(
        keepSelected
      )
    ),
    ...(idsToRemove.includes('pots') && { potsDetails: null })
  }
}

function viewContext(request, catalogue, overrides = {}) {
  const headingLine1 = t('removeGear.title')
  const journeyState = migrateGearJourneyState(request, catalogue)
  const gearIds = removableGearIds(request, journeyState, catalogue)
  const vesselName =
    journeyState.selectedVesselName ||
    (liveCatchRecords() ? '' : getData('selectVessel').name)

  return {
    pageTitle: `${headingLine1} ${vesselName}`.trim(),
    headingLine1,
    vesselName,
    backLink: {
      href: resolveNextPath(request, GEAR_SELECTION_PATH),
      text: t('header.back')
    },
    gearCheckboxItems: gearCheckboxItems(
      getFavouriteGearOptions(gearIds, catalogue)
    ),
    ...overrides
  }
}

function renderWithError(request, h, catalogue) {
  const errorText = t('removeGear.error.select')

  return h
    .view(
      'remove-gear/index',
      viewContext(request, catalogue, {
        errorSummary: {
          titleText: t('common.errorSummary.title'),
          errorList: [{ text: errorText, href: '#gearIds' }]
        },
        fieldErrors: { gearIds: errorText }
      })
    )
    .code(statusCodes.badRequest)
    .takeover()
}

export const removeGearController = {
  async handler(request, h) {
    await loadFavouriteGears(request)
    const catalogue = await getGearCatalogue()
    return h.view('remove-gear/index', viewContext(request, catalogue))
  }
}

export const removeGearSubmitController = {
  async handler(request, h) {
    await loadFavouriteGears(request)
    const catalogue = await getGearCatalogue()
    const journeyState = migrateGearJourneyState(request, catalogue)
    const favouriteGearIds = getFavouriteGearIds(journeyState, catalogue)
    const gearIds = removableGearIds(request, journeyState, catalogue)

    if (getFavouriteGearOptions(gearIds, catalogue).length === 0) {
      return h
        .redirect(resolveNextPath(request, GEAR_SELECTION_PATH))
        .code(statusCodes.seeOther)
    }

    const rawGearIds = request.payload?.gearIds

    if (!rawGearIds) {
      return renderWithError(request, h, catalogue)
    }

    const requestedIds = Array.isArray(rawGearIds) ? rawGearIds : [rawGearIds]
    const idsToRemove = [
      ...new Set(requestedIds.filter((id) => gearIds.includes(id)))
    ]

    if (idsToRemove.length === 0) {
      return renderWithError(request, h, catalogue)
    }

    if (liveCatchRecords()) {
      const favouriteIdsToRemove = idsToRemove.filter((id) =>
        favouriteGearIds.includes(id)
      )
      if (favouriteIdsToRemove.length) {
        await removeFavouriteGears(request, favouriteIdsToRemove)
      }
      if (isCatchRecordJourney(request)) {
        setJourneyState(request, {
          ...remainingTripGearState(journeyState, idsToRemove),
          journeyGearIds: (journeyState.journeyGearIds || []).filter(
            (id) => !idsToRemove.includes(id)
          )
        })
      }
      return h
        .redirect(resolveNextPath(request, GEAR_SELECTION_PATH))
        .code(statusCodes.seeOther)
    }

    const remainingFavouriteGearIds = favouriteGearIds.filter(
      (id) => !idsToRemove.includes(id)
    )

    setJourneyState(request, {
      favouriteGearIds: remainingFavouriteGearIds,
      ...remainingTripGearState(journeyState, idsToRemove)
    })

    return h
      .redirect(resolveNextPath(request, GEAR_SELECTION_PATH))
      .code(statusCodes.seeOther)
  }
}
