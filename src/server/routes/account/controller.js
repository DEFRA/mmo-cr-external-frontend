import { getData } from '#/server/common/data/get-data.js'
import { isSignedIn } from '#/server/common/helpers/auth/session.js'
import {
  getJourneyState,
  setJourneyState,
  accountVesselPath
} from '#/server/common/helpers/journey/navigation.js'
import { getAccountPortsUsed } from '#/server/common/helpers/account/account-ports.js'
import {
  formatGearMeasurements,
  getFavouriteGearIds,
  getFavouriteGearMeasurements,
  getFavouriteGearOptions,
  getGearCatalogue
} from '#/server/common/helpers/gear/favourite-gear.js'
import { getSpeciesPageData } from '#/server/common/helpers/species/species-list.js'
import {
  getVesselItem,
  getVesselCatalogue
} from '#/server/common/helpers/vessels/vessels-list.js'
import {
  loadFavouriteGears,
  loadFavouritePorts
} from '#/server/common/helpers/journey/session-favourites.js'
import { liveCatchRecords } from '#/server/common/helpers/journey/catch-record-service.js'
import { loadVesselSkippers } from '#/server/common/helpers/journey/vessel-skippers.js'
import Joi from 'joi'
import Boom from '@hapi/boom'

const NOT_IMPLEMENTED_HREF = '/not-implemented?return=/account'

function row(key, value, href, actionText, visuallyHiddenText) {
  return {
    key: { text: key },
    value: { html: value },
    actions: {
      items: [
        {
          href,
          text: actionText,
          visuallyHiddenText
        }
      ]
    }
  }
}

function joinLines(items) {
  return items.join('<br>')
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function buildPersonalDetailsSection(account, vesselLabel) {
  return {
    heading: 'Personal details',
    rows: [
      row(
        'Email address',
        account.email,
        '/change-email',
        'Change',
        'email address'
      ),
      row(
        'Password',
        account.passwordMasked,
        '/reset-password',
        'Change',
        'password'
      ),
      row(
        'Vessel owned',
        vesselLabel,
        '/change-vessel-owner',
        'Change',
        'vessel owned'
      ),
      row(
        'Vessels skipper of',
        account.vesselsSkipperOf,
        NOT_IMPLEMENTED_HREF,
        'Change',
        'vessels skipper of'
      ),
      row(
        'Address',
        joinLines(account.addressLines),
        '/change-address',
        'Change',
        'address'
      ),
      row(
        'Contact number',
        account.contactNumber,
        '/change-contact-number',
        'Change',
        'contact number'
      )
    ]
  }
}

function skippersRow(account, skipper) {
  if (liveCatchRecords() && Array.isArray(skipper)) {
    return {
      key: { text: 'Skippers' },
      value: {
        html: skipper.length
          ? joinLines(skipper.map((item) => escapeHtml(item.name)))
          : 'N/A'
      },
      actions: {
        items: [
          {
            href: '/add-skipper',
            text: 'Add skipper',
            visuallyHiddenText: 'skipper'
          },
          ...(skipper.length
            ? [
                {
                  href: '/remove-skipper',
                  text: 'Remove skipper',
                  visuallyHiddenText: 'skipper'
                }
              ]
            : [])
        ]
      }
    }
  }
  return {
    key: { text: 'Skippers' },
    value: {
      html: skipper
        ? `${escapeHtml(skipper.firstName)} ${escapeHtml(skipper.lastName)}`
        : account.skippers
    },
    actions: {
      items: [
        {
          href: '/add-skipper',
          text: 'Add skipper',
          visuallyHiddenText: 'skipper'
        }
      ]
    }
  }
}

function portsUsedRow(portsUsed) {
  return {
    key: { text: 'Ports used' },
    value: { html: joinLines(portsUsed.map(escapeHtml)) },
    actions: {
      items: [
        {
          href: '/add-port?for=departure&return=/account',
          text: 'Add port',
          visuallyHiddenText: 'port'
        },
        {
          href: '/remove-port',
          text: 'Remove port',
          visuallyHiddenText: 'port'
        }
      ]
    }
  }
}

function hintLine(text) {
  return `<span class="govuk-hint govuk-!-margin-bottom-0">${text}</span>`
}

function savedMeasurementLines(option, measurementValues) {
  return formatGearMeasurements(option, measurementValues).map((line) =>
    hintLine(escapeHtml(line))
  )
}

function gearOnboardRow(favouriteGearOptions, favouriteGearMeasurements = {}) {
  const gearOnboardLines = favouriteGearOptions.flatMap((option) => {
    const measurementLines = savedMeasurementLines(
      option,
      favouriteGearMeasurements[option.id]
    )
    if (measurementLines.length) {
      return [option.label, ...measurementLines]
    }
    return option.hint ? [option.label, hintLine(option.hint)] : [option.label]
  })

  return {
    key: { text: 'Gear onboard' },
    value: { html: joinLines(gearOnboardLines) },
    actions: {
      items: [
        {
          href: '/add-gear?return=/account',
          text: 'Add gear',
          visuallyHiddenText: 'gear'
        },
        {
          href: '/remove-gear?return=/account',
          text: 'Remove gear',
          visuallyHiddenText: 'gear'
        }
      ]
    }
  }
}

function speciesCaughtRow(speciesCaught) {
  return {
    key: { text: 'Species caught' },
    value: { html: joinLines(speciesCaught) },
    actions: {
      items: [
        {
          href: '/add-species?return=/account',
          text: 'Add species',
          visuallyHiddenText: 'species'
        },
        {
          href: '/remove-species?return=/account',
          text: 'Remove species',
          visuallyHiddenText: 'species'
        }
      ]
    }
  }
}

function buildVesselDetailsSection(
  account,
  vesselLabel,
  speciesCaught,
  skipper,
  portsUsed,
  favouriteGearOptions,
  favouriteGearMeasurements
) {
  return {
    heading: 'Vessel details',
    vesselLabel,
    rows: [
      skippersRow(account, skipper),
      portsUsedRow(portsUsed),
      gearOnboardRow(favouriteGearOptions, favouriteGearMeasurements),
      speciesCaughtRow(speciesCaught)
    ]
  }
}

async function buildLiveVesselSection(request, account, vessel) {
  const scopedRequest = { ...request, query: { vesselId: vessel.id } }
  setJourneyState(scopedRequest, {
    selectedVesselId: vessel.id,
    selectedVesselName: vessel.name,
    selectedVesselLengthOverallMetres: vessel.lengthOverallMetres
  })
  const [, , , { speciesOptions }, catalogue] = await Promise.all([
    loadFavouriteGears(scopedRequest),
    loadFavouritePorts(scopedRequest),
    loadVesselSkippers(scopedRequest),
    getSpeciesPageData(scopedRequest, { loadFavourites: true }),
    getGearCatalogue()
  ])
  const state = getJourneyState(scopedRequest)
  const section = buildVesselDetailsSection(
    account,
    `${vessel.name}${vessel.pln ? ` (${vessel.pln})` : ''}`,
    speciesOptions.map((species) => species.text),
    state.vesselSkippers,
    getAccountPortsUsed(state),
    getFavouriteGearOptions(getFavouriteGearIds(state, catalogue), catalogue),
    getFavouriteGearMeasurements(state)
  )
  for (const row of section.rows) {
    for (const action of row.actions.items) {
      action.href = accountVesselPath(scopedRequest, action.href)
    }
  }
  return section
}

export const accountController = {
  async handler(request, h) {
    if (!isSignedIn(request)) {
      return h.redirect('/sign-in').code(302)
    }
    if (liveCatchRecords()) {
      const account = getData('account')
      const example = getData('selectVessel')
      const vessels = await getVesselCatalogue()
      const vesselSections = await Promise.all(
        vessels.map((vessel) =>
          buildLiveVesselSection(request, account, vessel)
        )
      )
      return h.view('account/index', {
        pageTitle: 'Your account',
        heading: 'Your account',
        backLink: { href: '/records', text: 'Back' },
        sections: [
          buildPersonalDetailsSection(
            account,
            `${example.name} (${example.registration})`
          ),
          ...vesselSections.map((section, index) => ({
            ...section,
            heading: index === 0 ? 'Vessel details' : ''
          }))
        ]
      })
    }

    const account = getData('account')
    const vessel = getData('selectVessel')
    const vesselLabel = `${vessel.name} (${vessel.registration})`
    await loadFavouriteGears(request)
    await loadFavouritePorts(request)
    if (getJourneyState(request).selectedVesselId) {
      await loadVesselSkippers(request)
    }
    const journeyState = getJourneyState(request)
    const selectedVessel = journeyState.selectedVesselId
      ? await getVesselItem(journeyState.selectedVesselId)
      : null
    const selectedVesselName =
      selectedVessel?.name || journeyState.selectedVesselName
    const selectedVesselRegistration = selectedVessel?.pln
      ? ` (${selectedVessel.pln})`
      : ''
    const selectedVesselLabel = selectedVesselName
      ? `${selectedVesselName}${selectedVesselRegistration}`
      : vesselLabel
    const skipper = journeyState.skipper
    const portsUsed = getAccountPortsUsed(journeyState)
    const gearCatalogue = await getGearCatalogue()
    const favouriteGearOptions = getFavouriteGearOptions(
      getFavouriteGearIds(journeyState, gearCatalogue),
      gearCatalogue
    )
    const { speciesOptions } = await getSpeciesPageData(request, {
      loadFavourites: true
    })
    const speciesCaught = speciesOptions.map((species) => species.text)

    return h
      .view('account/index', {
        pageTitle: 'Your account',
        heading: 'Your account',
        ...(request.app.accountVesselError
          ? {
              errorSummary: {
                titleText: 'There is a problem',
                errorList: [
                  { text: request.app.accountVesselError, href: '#vesselId' }
                ]
              },
              fieldErrors: { vesselId: request.app.accountVesselError }
            }
          : {}),
        backLink: {
          href: '/records',
          text: 'Back'
        },
        sections: [
          buildPersonalDetailsSection(account, vesselLabel),
          buildVesselDetailsSection(
            account,
            selectedVesselLabel,
            speciesCaught,
            skipper,
            portsUsed,
            favouriteGearOptions,
            getFavouriteGearMeasurements(journeyState)
          )
        ]
      })
      .code(request.app.accountVesselError ? 400 : 200)
  }
}

export const accountVesselSubmitController = {
  options: {
    validate: {
      payload: Joi.object({ vesselId: Joi.string().trim().required() }),
      async failAction(request, h) {
        if (!isSignedIn(request)) {
          return h.redirect('/sign-in').code(302).takeover()
        }
        if (!liveCatchRecords()) throw Boom.notFound()
        request.app.accountVesselError =
          'Select a vessel to manage its favourites'
        return (await accountController.handler(request, h)).takeover()
      }
    }
  },
  async handler(request, h) {
    if (!isSignedIn(request)) return h.redirect('/sign-in').code(302)
    if (!liveCatchRecords()) throw Boom.notFound()
    const vessels = await getVesselCatalogue()
    const vessel = vessels.find((item) => item.id === request.payload.vesselId)
    if (!vessel) {
      request.app.accountVesselError = 'Select a vessel from the list'
      return accountController.handler(request, h)
    }
    const selected = await getVesselItem(vessel.id)
    if (request.yar.get('accountJourney')?.selectedVesselId !== selected.id) {
      request.yar.set('accountJourney', {
        selectedVesselId: selected.id,
        selectedVesselName: selected.name,
        selectedVesselLengthOverallMetres: selected.lengthOverallMetres
      })
    }
    return h.redirect('/account').code(303)
  }
}
