import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import {
  mockSpeciesReferenceData,
  restoreSpeciesReferenceDataMock,
  SPECIES_IDS
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

describe('#removeSpeciesController', () => {
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
      url: '/remove-species'
    })

    expect(result).toEqual(
      expect.stringContaining('Remove species from vessel |')
    )
    expect(statusCode).toBe(statusCodes.ok)
  })

  test.each([
    [VESSEL_IDS.achilles, 'ACHILLES'],
    [VESSEL_IDS.seaSpray, 'SEA SPRAY']
  ])(
    'Should show the chosen vessel on Add and Remove species for %s',
    async (vesselId, vesselName) => {
      const selection = await server.inject({
        method: 'POST',
        url: '/select-vessel',
        payload: { vesselId }
      })
      expect(selection.statusCode).toBe(statusCodes.seeOther)
      const cookie = selection.headers['set-cookie'][0].split(';')[0]

      for (const route of ['add-species', 'remove-species']) {
        for (const method of ['GET', 'POST']) {
          const { result, statusCode } = await server.inject({
            method,
            url: `/${route}?return=/species-selection`,
            headers: { cookie },
            ...(method === 'POST' && { payload: {} })
          })
          const $ = load(result)
          const heading =
            route === 'add-species'
              ? 'Add species to your vessel'
              : 'Remove species from vessel'

          expect(statusCode).toBe(
            method === 'GET' ? statusCodes.ok : statusCodes.badRequest
          )
          expect($('h1 [class~="govuk-!-display-block"]').text()).toBe(
            vesselName
          )
          expect($('title').text()).toContain(`${heading} ${vesselName}`)
          expect(
            $('[data-testid="app-page-navigation-back-link"]').attr('href')
          ).toBe('/species-selection')
        }
      }
    }
  )

  test('Should update both species headings when the vessel changes in the same journey', async () => {
    let cookie

    for (const [vesselId, vesselName] of [
      [VESSEL_IDS.achilles, 'ACHILLES'],
      [VESSEL_IDS.seaSpray, 'SEA SPRAY']
    ]) {
      const selection = await server.inject({
        method: 'POST',
        url: '/select-vessel',
        payload: { vesselId },
        ...(cookie && { headers: { cookie } })
      })
      expect(selection.statusCode).toBe(statusCodes.seeOther)
      cookie = selection.headers['set-cookie'][0].split(';')[0]

      for (const [route, heading] of [
        ['add-species', 'Add species to your vessel'],
        ['remove-species', 'Remove species from vessel']
      ]) {
        const response = await server.inject({
          method: 'GET',
          url: `/${route}?return=/species-selection`,
          headers: { cookie }
        })
        const $ = load(response.result)
        expect(response.statusCode).toBe(statusCodes.ok)
        expect($('h1').text().replace(/\s+/g, ' ').trim()).toBe(
          `New catch record ${heading} ${vesselName}`
        )
        expect($('title').text()).toContain(`${heading} ${vesselName}`)
        cookie = response.headers['set-cookie']?.[0]?.split(';')[0] || cookie
      }
    }
  })

  test('Should render the Back link to the species selection page', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/remove-species'
    })
    const $ = load(result)

    expect(
      $('[data-testid="app-page-navigation-back-link"]').attr('href')
    ).toBe('/species-selection')
  })

  test('Should render the New catch record caption above the heading', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/remove-species'
    })
    const $ = load(result)

    expect($('.govuk-caption-l').text().trim()).toBe('New catch record')
  })

  test('Should render the "Select all that apply" hint', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/remove-species'
    })
    const $ = load(result)

    expect($('.govuk-hint').first().text().trim()).toBe('Select all that apply')
  })

  test('Should render 3 unchecked species checkboxes by default', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/remove-species'
    })
    const $ = load(result)
    const checkboxes = $('input[type="checkbox"][name="speciesIds"]')

    expect(checkboxes).toHaveLength(3)
    checkboxes.each((_, el) => {
      expect($(el).prop('checked')).toBe(false)
    })
  })

  test('Should show the empty state and return to account when no species remains', async () => {
    const removeResponse = await server.inject({
      method: 'POST',
      url: '/remove-species',
      payload: {
        speciesIds: [SPECIES_IDS.cod, SPECIES_IDS.haddock, SPECIES_IDS.mackerel]
      }
    })
    const cookie = removeResponse.headers['set-cookie'][0].split(';')[0]
    const { result } = await server.inject({
      method: 'GET',
      url: '/remove-species?return=/account',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('body').text()).toContain('No species to remove')
    expect($('input[name="speciesIds"]')).toHaveLength(0)
    expect($('.govuk-button').text().trim()).toBe('Continue')

    const continueResponse = await server.inject({
      method: 'POST',
      url: '/remove-species?return=/account',
      payload: {},
      headers: { cookie }
    })

    expect(continueResponse.statusCode).toBe(303)
    expect(continueResponse.headers.location).toBe('/account')
  })
})

describe('#removeSpeciesSubmitController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should re-render with an error when nothing is selected', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/remove-species',
      payload: {}
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary').text()).toContain(
      'Select the species you want to remove'
    )
  })

  test('Should remove the selected species and redirect to species selection', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/remove-species',
      payload: { speciesIds: 'had' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/species-selection')
  })

  test('Should also drop a removed species from a previously-made species selection', async () => {
    const selectionResponse = await server.inject({
      method: 'POST',
      url: '/species-selection',
      payload: {
        speciesIds: ['cod', 'had'],
        speciesAction: 'continue',
        'weightAboveMinimum-cod': '5',
        'weightAboveMinimum-had': '5'
      }
    })
    let cookie = selectionResponse.headers['set-cookie'][0].split(';')[0]

    const removeResponse = await server.inject({
      method: 'POST',
      url: '/remove-species',
      payload: { speciesIds: 'had' },
      headers: { cookie }
    })
    cookie = removeResponse.headers['set-cookie'][0].split(';')[0]

    const { result } = await server.inject({
      method: 'GET',
      url: '/species-selection',
      headers: { cookie }
    })
    const $ = load(result)

    expect($(`input[value="${SPECIES_IDS.haddock}"]`)).toHaveLength(0)
    expect($(`input[value="${SPECIES_IDS.cod}"]`).prop('checked')).toBe(true)
  })

  test('Should no longer show a removed species as a checkbox on species selection', async () => {
    const setResponse = await server.inject({
      method: 'POST',
      url: '/remove-species',
      payload: { speciesIds: 'had' }
    })
    const cookie = setResponse.headers['set-cookie'][0].split(';')[0]

    const { result } = await server.inject({
      method: 'GET',
      url: '/species-selection',
      headers: { cookie }
    })
    const $ = load(result)

    expect($(`input[value="${SPECIES_IDS.haddock}"]`)).toHaveLength(0)
    expect($('input[type="checkbox"][name="speciesIds"]')).toHaveLength(2)
  })

  test('Should redirect to add species when all species have been removed', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/remove-species',
      payload: { speciesIds: ['cod', 'had', 'mac'] }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/add-species')
  })

  test('Should redirect back to check your answers when a return query is supplied', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/remove-species?return=/check-answers',
      payload: { speciesIds: 'had' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/check-answers')
  })
})
