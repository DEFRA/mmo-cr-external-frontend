import { t } from '#/server/common/helpers/i18n/translator.js'

import {
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

function viewContext(request, catalogue, overrides = {}) {
  const headingLine1 = t('removeGear.title')
  const journeyState = migrateGearJourneyState(request, catalogue)
  const favouriteGearIds = getFavouriteGearIds(journeyState, catalogue)
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
      getFavouriteGearOptions(favouriteGearIds, catalogue)
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

    if (getFavouriteGearOptions(favouriteGearIds, catalogue).length === 0) {
      return h
        .redirect(resolveNextPath(request, GEAR_SELECTION_PATH))
        .code(statusCodes.seeOther)
    }

    const rawGearIds = request.payload?.gearIds

    if (!rawGearIds) {
      return renderWithError(request, h, catalogue)
    }

    const requestedIds = Array.isArray(rawGearIds) ? rawGearIds : [rawGearIds]
    const idsToRemove = requestedIds.filter((id) =>
      favouriteGearIds.includes(id)
    )

    if (idsToRemove.length === 0) {
      return renderWithError(request, h, catalogue)
    }

    if (liveCatchRecords()) {
      await removeFavouriteGears(request, [...new Set(idsToRemove)])
      return h
        .redirect(resolveNextPath(request, GEAR_SELECTION_PATH))
        .code(statusCodes.seeOther)
    }

    const remainingFavouriteGearIds = favouriteGearIds.filter(
      (id) => !idsToRemove.includes(id)
    )
    const remainingSelectedGearIds = (
      journeyState.selectedGearIds || []
    ).filter((id) => !idsToRemove.includes(id))

    setJourneyState(request, {
      favouriteGearIds: remainingFavouriteGearIds,
      selectedGearIds: remainingSelectedGearIds,
      catchDetailsByGearId: Object.fromEntries(
        Object.entries(journeyState.catchDetailsByGearId || {}).filter(([id]) =>
          remainingSelectedGearIds.includes(id)
        )
      ),
      gearMeasurementDetails: Object.fromEntries(
        Object.entries(journeyState.gearMeasurementDetails || {}).filter(
          ([id]) => remainingSelectedGearIds.includes(id)
        )
      ),
      ...(idsToRemove.includes('pots') && { potsDetails: null })
    })

    return h
      .redirect(resolveNextPath(request, GEAR_SELECTION_PATH))
      .code(statusCodes.seeOther)
  }
}
