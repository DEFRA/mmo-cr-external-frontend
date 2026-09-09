import { getData } from '#/server/common/data/get-data.js'
import { isSignedIn } from '#/server/common/helpers/auth/session.js'
import { getJourneyState } from '#/server/common/helpers/journey/navigation.js'

const NOT_IMPLEMENTED_HREF = '/not-implemented?return=/account'

function row(key, value, actionText, visuallyHiddenText) {
  return {
    key: { text: key },
    value: { html: value },
    actions: {
      items: [
        {
          href: NOT_IMPLEMENTED_HREF,
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
      row('Email address', account.email, 'Change', 'email address'),
      row('Password', account.passwordMasked, 'Change', 'password'),
      row('Vessel owned', vesselLabel, 'Change', 'vessel owned'),
      row(
        'Vessels skipper of',
        account.vesselsSkipperOf,
        'Change',
        'vessels skipper of'
      ),
      row('Address', joinLines(account.addressLines), 'Change', 'address'),
      row('Contact number', account.contactNumber, 'Change', 'contact number')
    ]
  }
}

function buildVesselDetailsSection(
  account,
  vesselLabel,
  speciesCaught,
  skipper
) {
  const gearOnboardLines = account.gearOnboard.flatMap((gear) =>
    gear.hint
      ? [
          gear.label,
          `<span class="govuk-hint govuk-!-margin-bottom-0">${gear.hint}</span>`
        ]
      : [gear.label]
  )

  return {
    heading: 'Vessel details',
    vesselLabel,
    rows: [
      {
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
      },
      {
        key: { text: 'Ports used' },
        value: { html: joinLines(account.portsUsed) },
        actions: {
          items: [
            {
              href: NOT_IMPLEMENTED_HREF,
              text: 'Add port',
              visuallyHiddenText: 'port'
            },
            {
              href: NOT_IMPLEMENTED_HREF,
              text: 'Remove port',
              visuallyHiddenText: 'port'
            }
          ]
        }
      },
      {
        key: { text: 'Gear onboard' },
        value: { html: joinLines(gearOnboardLines) },
        actions: {
          items: [
            {
              href: NOT_IMPLEMENTED_HREF,
              text: 'Add gear',
              visuallyHiddenText: 'gear'
            },
            {
              href: NOT_IMPLEMENTED_HREF,
              text: 'Remove gear',
              visuallyHiddenText: 'gear'
            }
          ]
        }
      },
      {
        key: { text: 'Species caught' },
        value: { html: joinLines(speciesCaught) },
        actions: {
          items: [
            {
              href: NOT_IMPLEMENTED_HREF,
              text: 'Add species',
              visuallyHiddenText: 'species'
            },
            {
              href: NOT_IMPLEMENTED_HREF,
              text: 'Remove species',
              visuallyHiddenText: 'species'
            }
          ]
        }
      }
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
    const speciesCaught = getData('speciesSelection').map(
      (species) => species.text
    )
    const vesselLabel = `${vessel.name} (${vessel.registration})`
    const skipper = getJourneyState(request).skipper

    return h.view('account/index', {
      pageTitle: 'Your account',
      heading: 'Your account',
      backLink: {
        href: '/records',
        text: 'Back'
      },
      sections: [
        buildPersonalDetailsSection(account, vesselLabel),
        buildVesselDetailsSection(account, vesselLabel, speciesCaught, skipper)
      ]
    })
  }
}
