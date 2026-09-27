import { getData } from '#/server/common/data/get-data.js'
import { isSignedIn } from '#/server/common/helpers/auth/session.js'
import { getJourneyState } from '#/server/common/helpers/journey/navigation.js'
import { getAccountPortsUsed } from '#/server/common/helpers/account/account-ports.js'
import {
  getFavouriteGearIds,
  getFavouriteGearOptions
} from '#/server/common/helpers/gear/favourite-gear.js'
import {
  getAvailableSpeciesIds,
  getSpeciesOptionsByIds
} from '#/server/common/helpers/species/species-list.js'

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
    value: { html: joinLines(portsUsed) },
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

function gearOnboardRow(favouriteGearOptions) {
  const gearOnboardLines = favouriteGearOptions.flatMap((option) =>
    option.hint
      ? [
          option.label,
          `<span class="govuk-hint govuk-!-margin-bottom-0">${option.hint}</span>`
        ]
      : [option.label]
  )

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
  favouriteGearOptions
) {
  return {
    heading: 'Vessel details',
    vesselLabel,
    rows: [
      skippersRow(account, skipper),
      portsUsedRow(portsUsed),
      gearOnboardRow(favouriteGearOptions),
      speciesCaughtRow(speciesCaught)
    ]
  }
}

export const accountController = {
  handler(request, h) {
    if (!isSignedIn(request)) {
      return h.redirect('/sign-in').code(302)
    }

    const account = getData('account')
    const vessel = getData('selectVessel')
    const vesselLabel = `${vessel.name} (${vessel.registration})`
    const journeyState = getJourneyState(request)
    const skipper = journeyState.skipper
    const portsUsed = getAccountPortsUsed(journeyState)
    const favouriteGearOptions = getFavouriteGearOptions(
      getFavouriteGearIds(journeyState)
    )
    const speciesCaught = getSpeciesOptionsByIds(
      getAvailableSpeciesIds(journeyState)
    ).map((species) => species.text)

    return h.view('account/index', {
      pageTitle: 'Your account',
      heading: 'Your account',
      backLink: {
        href: '/records',
        text: 'Back'
      },
      sections: [
        buildPersonalDetailsSection(account, vesselLabel),
        buildVesselDetailsSection(
          account,
          vesselLabel,
          speciesCaught,
          skipper,
          portsUsed,
          favouriteGearOptions
        )
      ]
    })
  }
}
