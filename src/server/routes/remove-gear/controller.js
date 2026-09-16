import {
  getJourneyState,
  resolveNextPath,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'
import {
  getFavouriteGearIds,
  getFavouriteGearOptions
} from '#/server/common/helpers/gear/favourite-gear.js'
import { getData } from '#/server/common/data/get-data.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

const { name: vesselName } = getData('selectVessel')
const headingLine1 = 'Remove gear from vessel'

function gearCheckboxItems(favouriteOptions) {
  return favouriteOptions.map((option) => ({
    value: option.id,
    text: option.label,
    hint: option.hint
  }))
}

function viewContext(request, overrides = {}) {
  const favouriteGearIds = getFavouriteGearIds(getJourneyState(request))

  return {
    pageTitle: `${headingLine1} ${vesselName}`,
    headingLine1,
    vesselName,
    backLink: {
      href: '/gear-selection',
      text: 'Back'
    },
    gearCheckboxItems: gearCheckboxItems(
      getFavouriteGearOptions(favouriteGearIds)
    ),
    ...overrides
  }
}

function renderWithError(request, h) {
  const errorText = 'Select the gear you want to remove'

  return h
    .view(
      'remove-gear/index',
      viewContext(request, {
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
  handler(request, h) {
    return h.view('remove-gear/index', viewContext(request))
  }
}

export const removeGearSubmitController = {
  handler(request, h) {
    const rawGearIds = request.payload.gearIds

    if (!rawGearIds) {
      return renderWithError(request, h)
    }

    const requestedIds = Array.isArray(rawGearIds) ? rawGearIds : [rawGearIds]
    const journeyState = getJourneyState(request)
    const favouriteGearIds = getFavouriteGearIds(journeyState)
    const idsToRemove = requestedIds.filter((id) =>
      favouriteGearIds.includes(id)
    )

    if (idsToRemove.length === 0) {
      return renderWithError(request, h)
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
      ...(idsToRemove.includes('pots') && { potsDetails: undefined })
    })

    return h.redirect(resolveNextPath(request, '/gear-selection')).code(statusCodes.seeOther)
  }
}
