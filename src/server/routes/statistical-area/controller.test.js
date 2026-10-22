import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import {
  mockSpeciesReferenceData,
  restoreSpeciesReferenceDataMock
} from '#/test-helpers/mock-species-reference-data.js'
import { mockPortsReferenceData } from '#/test-helpers/mock-ports-reference-data.js'
import { statisticalAreaController } from './controller.js'
import { statisticalAreaOtherController } from '../statistical-area-other/controller.js'
import { getData } from '#/server/common/data/get-data.js'

beforeEach(() => {
  mockSpeciesReferenceData()
  mockPortsReferenceData()
})
afterEach(() => restoreSpeciesReferenceDataMock())

async function withDeparturePort(server, code) {
  const response = await server.inject({
    method: 'POST',
    url: '/departure-port',
    payload: { departurePort: code }
  })
  return response.headers['set-cookie'][0].split(';')[0]
}

describe('#statisticalAreaController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should redirect to the departure port page when no departure port has been selected', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: '/statistical-area'
    })

    expect(statusCode).toBe(statusCodes.seeOther)
    expect(headers.location).toBe('/departure-port')
  })

  test('Should restore the API coordinate for an existing Hamnavoe journey', async () => {
    const journeyState = { departurePort: 'GBHMV' }
    const request = {
      yar: {
        get: () => journeyState,
        set: (_key, patch) => Object.assign(journeyState, patch)
      }
    }
    const h = { view: vi.fn() }
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => '"hamnavoe-test"' },
      json: async () => ({
        items: [
          {
            id: '00000000-0000-4000-8000-000000000036',
            code: 'GBHMV',
            name: 'Hamnavoe, Burra Isle',
            coordinate: {
              longitude: -1.32197999954224,
              latitude: 60.103401184082
            }
          }
        ],
        total: 1,
        offset: 0,
        limit: 50
      })
    })

    await statisticalAreaController.handler(request, h)

    expect(h.view).toHaveBeenCalledWith(
      'statistical-area/index',
      expect.objectContaining({
        departurePortName: 'Hamnavoe, Burra Isle',
        departurePortCoordinate: [-1.32197999954224, 60.103401184082]
      })
    )
  })

  test('Should provide expected response', async () => {
    const cookie = await withDeparturePort(server, 'hastings')

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/statistical-area',
      headers: { cookie }
    })

    expect(result).toEqual(
      expect.stringContaining('Where was the majority of your catch caught? |')
    )
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should render the question as the page heading with caption', async () => {
    const cookie = await withDeparturePort(server, 'hastings')

    const { result } = await server.inject({
      method: 'GET',
      url: '/statistical-area',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('h1').text()).toContain(
      'Where was the majority of your catch caught?'
    )
    expect($('.govuk-caption-l').first().text().trim()).toBe('New catch record')
  })

  test.each(getData('gearCatalogue'))(
    'Should render distinct headings and matching guidance on both area pages for $label',
    async ({ id, label }) => {
      const state = {
        selectedGearIds: [id],
        departurePort: 'hastings',
        portCoordinatesByCode: { hastings: [0.58, 50.85] }
      }
      const request = { yar: { get: () => state } }
      const h = { view: vi.fn() }

      await statisticalAreaController.handler(request, h)
      await statisticalAreaOtherController.handler(request, h)

      const mapContext = h.view.mock.calls[0][1]
      const otherContext = h.view.mock.calls[1][1]
      expect(mapContext.heading).toBe(
        `Where was the majority of your catch caught using ${label}?`
      )
      expect(otherContext.heading).toBe(
        `Select the statistical sub area where the majority of your catch was caught using ${label}`
      )
      expect(otherContext.pageTitle).toBe(otherContext.heading)
      expect(otherContext.bodyText).toEqual(mapContext.bodyText)
    }
  )

  test.each([
    [undefined, 'Pots'],
    ['api-pots', 'Pots'],
    ['api-seine', 'Seine nets']
  ])(
    'Should show only the current gear on both area pages for gearId %s',
    async (gearId, label) => {
      const state = {
        selectedGearIds: ['api-pots', 'api-seine'],
        selectedGearNamesById: {
          'api-pots': 'Pots',
          'api-seine': 'Seine nets'
        },
        departurePort: 'hastings',
        portCoordinatesByCode: { hastings: [0.58, 50.85] }
      }
      const request = {
        yar: { get: () => state },
        query: gearId ? { gearId } : {}
      }
      const h = { view: vi.fn() }

      await statisticalAreaController.handler(request, h)
      await statisticalAreaOtherController.handler(request, h)

      expect(h.view.mock.calls[0][1].heading).toBe(
        `Where was the majority of your catch caught using ${label}?`
      )
      expect(h.view.mock.calls[1][1].heading).toBe(
        `Select the statistical sub area where the majority of your catch was caught using ${label}`
      )
    }
  )

  test('Should render the offline map and the Other action', async () => {
    const cookie = await withDeparturePort(server, 'hastings')

    const { result } = await server.inject({
      method: 'GET',
      url: '/statistical-area',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('.app-statistical-area-map__surface')).toHaveLength(0)
    expect($('.app-offline-map').attr('data-departure-port')).toBe('Hastings')
    expect($('.app-offline-map__other').text().trim()).toBe('Other')
  })

  test('Should render the Back link to the gear selection page', async () => {
    const cookie = await withDeparturePort(server, 'hastings')

    const { result } = await server.inject({
      method: 'GET',
      url: '/statistical-area',
      headers: { cookie }
    })
    const $ = load(result)

    expect(
      $('[data-testid="app-page-navigation-back-link"]').attr('href')
    ).toBe('/gear-selection')
  })

  test('Should restore a previously-saved statistical area selection', async () => {
    const cookie = await withDeparturePort(server, 'hastings')

    const setResponse = await server.inject({
      method: 'POST',
      url: '/statistical-area',
      headers: { cookie },
      payload: { statisticalArea: '38f02' }
    })
    const updatedCookie =
      setResponse.headers['set-cookie']?.[0]?.split(';')[0] || cookie

    const { result } = await server.inject({
      method: 'GET',
      url: '/statistical-area',
      headers: { cookie: updatedCookie }
    })
    const $ = load(result)

    expect($('.app-offline-map').attr('data-selected-area')).toBe('38f02')
  })
})

describe('#statisticalAreaSubmitController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should redirect to species selection when a named area is chosen', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/statistical-area',
      payload: { statisticalArea: '38f02' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/species-selection')
  })

  test('Should accept a generated offline-map subrectangle code', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/statistical-area',
      payload: { statisticalArea: '27D86' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/species-selection')
  })

  test('Should redirect back to check your answers when a return query is supplied', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/statistical-area?return=/check-answers',
      payload: { statisticalArea: '38f02' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/check-answers')
  })

  test('Should set the direct branch back-link on species selection when a named area is chosen', async () => {
    const setResponse = await server.inject({
      method: 'POST',
      url: '/statistical-area',
      payload: { statisticalArea: '38f02' }
    })
    const cookie = setResponse.headers['set-cookie'][0].split(';')[0]

    const { result } = await server.inject({
      method: 'GET',
      url: '/species-selection',
      headers: { cookie }
    })
    const $ = load(result)

    expect(
      $('[data-testid="app-page-navigation-back-link"]').attr('href')
    ).toBe('/statistical-area')
  })

  test('Should redirect to the alternative statistical area page when Other is chosen', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/statistical-area',
      payload: { statisticalArea: 'other' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/statistical-area-other')
  })

  test('Should set the other branch back-link on species selection when Other is chosen', async () => {
    const setResponse = await server.inject({
      method: 'POST',
      url: '/statistical-area',
      payload: { statisticalArea: 'other' }
    })
    const cookie = setResponse.headers['set-cookie'][0].split(';')[0]

    const { result } = await server.inject({
      method: 'GET',
      url: '/species-selection',
      headers: { cookie }
    })
    const $ = load(result)

    expect(
      $('[data-testid="app-page-navigation-back-link"]').attr('href')
    ).toBe('/statistical-area-other')
  })

  test('Should re-render the page with an error summary when nothing is selected', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/statistical-area',
      payload: {}
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary')).toHaveLength(1)
    expect($('.govuk-error-summary').text()).toContain(
      'Select the area where most of your catch was caught'
    )
    expect($('.govuk-error-message')).toHaveLength(1)
  })

  test('Should reject an empty statistical area', async () => {
    const { statusCode } = await server.inject({
      method: 'POST',
      url: '/statistical-area',
      payload: { statisticalArea: '' }
    })

    expect(statusCode).toBe(statusCodes.badRequest)
  })

  test('Should re-render the page with an error summary for an unknown area value', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/statistical-area',
      payload: { statisticalArea: 'unknown' }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary')).toHaveLength(1)
  })
})
