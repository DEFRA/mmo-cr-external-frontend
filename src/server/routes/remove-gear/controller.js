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

const headingLine1 = 'Remove gear from vessel'

function gearCheckboxItems(favouriteOptions) {
  return favouriteOptions.map((option) => ({
    value: option.id,
    text: option.label,
    hint: option.hint
  }))
}

function viewContext(request, catalogue, overrides = {}) {
  const journeyState = migrateGearJourneyState(request, catalogue)
  const favouriteGearIds = getFavouriteGearIds(journeyState, catalogue)
  const vesselName =
    journeyState.selectedVesselName || getData('selectVessel').name

  return {
    pageTitle: `${headingLine1} ${vesselName}`,
    headingLine1,
    vesselName,
    backLink: {
      href: '/gear-selection',
      text: 'Back'
    },
    gearCheckboxItems: gearCheckboxItems(
      getFavouriteGearOptions(favouriteGearIds, catalogue)
    ),
    ...overrides
  }
}

function renderWithError(request, h, catalogue) {
  const errorText = 'Select the gear you want to remove'

  return h
    .view(
      'remove-gear/index',
      viewContext(request, catalogue, {
        errorSummary: {
          titleText: 'There is a problem',
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
    const catalogue = await getGearCatalogue()
    return h.view('remove-gear/index', viewContext(request, catalogue))
  }
}

export const removeGearSubmitController = {
  async handler(request, h) {
    const catalogue = await getGearCatalogue()
    const rawGearIds = request.payload.gearIds

    if (!rawGearIds) {
      return renderWithError(request, h, catalogue)
    }

    const requestedIds = Array.isArray(rawGearIds) ? rawGearIds : [rawGearIds]
    const journeyState = migrateGearJourneyState(request, catalogue)
    const favouriteGearIds = getFavouriteGearIds(journeyState, catalogue)
    const idsToRemove = requestedIds.filter((id) =>
      favouriteGearIds.includes(id)
    )

    if (idsToRemove.length === 0) {
      return renderWithError(request, h, catalogue)
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
      ...(idsToRemove.includes('pots') && { potsDetails: null })
    })

    return h
      .redirect(resolveNextPath(request, '/gear-selection'))
      .code(statusCodes.seeOther)
  }
}
