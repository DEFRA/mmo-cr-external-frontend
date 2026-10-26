import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import { getJourneyState } from '#/server/common/helpers/journey/navigation.js'
import {
  mockSpeciesReferenceData,
  restoreSpeciesReferenceDataMock,
  SPECIES_IDS,
  SPECIES_ITEMS
} from '#/test-helpers/mock-species-reference-data.js'
import {
  mockVesselsReferenceData,
  restoreVesselsReferenceDataMock,
  VESSEL_IDS
} from '#/test-helpers/mock-vessels-reference-data.js'

beforeEach(() => {
  mockSpeciesReferenceData()
  mockVesselsReferenceData()
})
afterEach(() => {
  restoreVesselsReferenceDataMock()
  restoreSpeciesReferenceDataMock()
})

describe('#addSpeciesController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should provide expected response', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/add-species'
    })

    expect(result).toEqual(
      expect.stringContaining('Add species to your vessel |')
    )
    expect(statusCode).toBe(statusCodes.ok)
  })

  test.each([
    [VESSEL_IDS.achilles, 'ACHILLES'],
    [VESSEL_IDS.seaSpray, 'SEA SPRAY']
  ])(
    'Should show the selected vessel %s on its own heading line',
    async (vesselId, vesselName) => {
      const selection = await server.inject({
        method: 'POST',
        url: '/select-vessel',
        payload: { vesselId }
      })
      const cookie = selection.headers['set-cookie'][0].split(';')[0]
      const { result } = await server.inject({
        method: 'GET',
        url: '/add-species?return=/species-selection',
        headers: { cookie }
      })
      const $ = load(result)

      expect($('h1 [class~="govuk-!-display-block"]').text()).toBe(vesselName)
      expect($('title').text()).toContain(
        `Add species to your vessel ${vesselName}`
      )
    }
  )

  test('Should render the Back link to the species selection page', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/add-species'
    })
    const $ = load(result)

    expect(
      $('[data-testid="app-page-navigation-back-link"]').attr('href')
    ).toBe('/species-selection')
  })

  test('Should point Back to the account when Add species was opened from the account', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/add-species?return=/account'
    })
    const $ = load(result)

    expect(
      $('[data-testid="app-page-navigation-back-link"]').attr('href')
    ).toBe('/account')
  })

  test('Should render the New catch record caption above the heading', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/add-species'
    })
    const $ = load(result)

    expect($('.govuk-caption-l').text().trim()).toBe('New catch record')
  })

  test('Should render the full species catalogue including already-added species', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/add-species'
    })
    const $ = load(result)

    expect($('#species option[value=""]').text()).toBe(
      'Start typing to display the list'
    )
    expect($('select[data-species-search][name="species"]')).toHaveLength(1)
    expect($('datalist')).toHaveLength(0)
    expect(
      $('#species option')
        .map((_, option) => $(option).val())
        .get()
    ).toEqual([
      '',
      ...SPECIES_ITEMS.map(
        (species) => `${species.displayName} (${species.faoCode})`
      )
    ])
  })
})

describe('#addSpeciesSubmitController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should re-render with an error when no species is entered', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/add-species',
      payload: { species: '' }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary').text()).toContain(
      'Enter the species you want to add'
    )
  })

  test('Should re-render with an error when the payload fails schema validation', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/add-species',
      payload: { species: { notAValidShape: true } }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary').text()).toContain(
      'Enter the species you want to add'
    )
  })

  test('Should re-render with an error when the entered species is not recognised', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/add-species',
      payload: { species: 'Not a real species' }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary').text()).toContain(
      'Select a species to add'
    )
  })

  test('Should re-render with an error when the species has already been added', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/add-species',
      payload: { species: 'Atlantic cod (COD)' }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary').text()).toContain(
      'This species has already been added.'
    )
    expect($('.govuk-error-summary a').attr('href')).toBe('#species')
    expect($('#species-error').text()).toContain(
      'This species has already been added.'
    )
    expect($('#species').attr('aria-describedby')).toBe('species-error')
    expect($('#species option[value="Atlantic cod (COD)"]')).toHaveLength(1)
  })

  test('Should keep an added species selectable and reject re-adding it from the account without duplicating it', async () => {
    const added = await server.inject({
      method: 'POST',
      url: '/add-species?return=/account',
      payload: { species: 'Herring (HER)' }
    })
    expect(added.statusCode).toBe(statusCodes.seeOther)
    expect(added.headers.location).toBe('/account')
    const cookie = added.headers['set-cookie'][0].split(';')[0]

    const page = await server.inject({
      method: 'GET',
      url: '/add-species?return=/account',
      headers: { cookie }
    })
    const $page = load(page.result)
    expect(page.statusCode).toBe(statusCodes.ok)
    expect($page('#species option[value="Herring (HER)"]')).toHaveLength(1)

    const duplicate = await server.inject({
      method: 'POST',
      url: '/add-species?return=/account',
      headers: { cookie },
      payload: { species: 'Herring (HER)' }
    })
    const $error = load(duplicate.result)
    expect(duplicate.statusCode).toBe(statusCodes.badRequest)
    expect($error('.govuk-error-summary').text()).toContain(
      'This species has already been added.'
    )
    expect($error('#species option[value="Herring (HER)"]')).toHaveLength(1)
    expect(getJourneyState(duplicate.request).availableSpeciesIds).toEqual([
      SPECIES_IDS.cod,
      SPECIES_IDS.haddock,
      SPECIES_IDS.mackerel,
      SPECIES_IDS.herring
    ])
    expect(
      $error('[data-testid="app-page-navigation-back-link"]').attr('href')
    ).toBe('/account')

    const selection = await server.inject({
      method: 'GET',
      url: '/species-selection',
      headers: { cookie }
    })
    const $selection = load(selection.result)
    expect(selection.statusCode).toBe(statusCodes.ok)
    expect($selection(`input[value="${SPECIES_IDS.herring}"]`)).toHaveLength(1)
  })

  test('Should add a new species and redirect to species selection', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/add-species',
      payload: { species: 'Herring (HER)' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/species-selection')
  })

  test('Should show the newly added species as a checkbox on species selection', async () => {
    const setResponse = await server.inject({
      method: 'POST',
      url: '/add-species',
      payload: { species: 'Herring (HER)' }
    })
    const cookie = setResponse.headers['set-cookie'][0].split(';')[0]

    const { result } = await server.inject({
      method: 'GET',
      url: '/species-selection',
      headers: { cookie }
    })
    const $ = load(result)

    expect($(`input[value="${SPECIES_IDS.herring}"]`)).toHaveLength(1)
  })

  test('Should redirect back to check your answers when a return query is supplied', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/add-species?return=/check-answers',
      payload: { species: 'Herring (HER)' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/check-answers')
  })
})
