import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import {
  mockPortsReferenceData,
  restorePortsReferenceDataMock
} from '#/test-helpers/mock-ports-reference-data.js'
import {
  mockGearsReferenceData,
  restoreGearsReferenceDataMock
} from '#/test-helpers/mock-gears-reference-data.js'
import { seedFavouriteGears } from '#/test-helpers/seed-favourite-gears.js'

beforeEach(() => {
  mockPortsReferenceData()
  mockGearsReferenceData()
})
afterEach(() => {
  restoreGearsReferenceDataMock()
  restorePortsReferenceDataMock()
})

describe('#gearSelectionController', () => {
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
      url: '/gear-selection'
    })

    expect(result).toEqual(expect.stringContaining('What gear did you use? |'))
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should render the question as the page heading with caption and hint', async () => {
    const favouriteCookie = await seedFavouriteGears(server)
    const { result } = await server.inject({
      method: 'GET',
      url: '/gear-selection',
      headers: { cookie: favouriteCookie }
    })
    const $ = load(result)

    expect($('h1').text()).toContain('What gear did you use?')
    expect($('h1 .govuk-caption-l').text().trim()).toBe('New catch record')
    expect($('.govuk-hint').first().text().trim()).toBe('Select all that apply')
  })

  test('Should render 9 gear checkboxes with the stable ids', async () => {
    const favouriteCookie = await seedFavouriteGears(server)
    const { result } = await server.inject({
      method: 'GET',
      url: '/gear-selection',
      headers: { cookie: favouriteCookie }
    })
    const $ = load(result)
    const checkboxes = $('input[type="checkbox"][name="gearIds"]')

    expect(checkboxes).toHaveLength(9)
    expect(checkboxes.map((_, el) => $(el).attr('value')).get()).toEqual([
      'beam-trawl',
      'bottom-otter-trawl',
      'dredge',
      'handlines-pole-lines',
      'miscellaneous-gear-diving',
      'pots',
      'seine-nets',
      'trammel-net',
      'traps'
    ])
  })

  test('Should always render the pots conditional fields in the DOM (progressive enhancement)', async () => {
    const favouriteCookie = await seedFavouriteGears(server)
    const { result } = await server.inject({
      method: 'GET',
      url: '/gear-selection',
      headers: { cookie: favouriteCookie }
    })
    const $ = load(result)

    expect($('#potsHauled')).toHaveLength(1)
    expect($('#potsInWater')).toHaveLength(1)
  })

  test('Should always render the other gear types conditional measurement fields in the DOM too', async () => {
    const favouriteCookie = await seedFavouriteGears(server)
    const { result } = await server.inject({
      method: 'GET',
      url: '/gear-selection',
      headers: { cookie: favouriteCookie }
    })
    const $ = load(result)

    expect($('#dredge-numberOfDredges')).toHaveLength(1)
    expect($('#dredge-numberOfTimesShot')).toHaveLength(1)
    expect($('#bottom-otter-trawl-numberOfTrawlNets')).toHaveLength(1)
    expect($('#bottom-otter-trawl-meshSize')).toHaveLength(1)
    expect($('#seine-nets-meshSize')).toHaveLength(1)
    expect($('#handlines-pole-lines-rodsAndLines')).toHaveLength(1)
    expect($('#traps-totalHauled')).toHaveLength(1)
    expect($('#traps-totalInWater')).toHaveLength(1)
  })

  test('Should render the Back link to the return port page', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/gear-selection'
    })
    const $ = load(result)

    expect(
      $('[data-testid="app-page-navigation-back-link"]').attr('href')
    ).toBe('/return-port')
  })

  test('Should render Add gear and Remove gear links', async () => {
    const favouriteCookie = await seedFavouriteGears(server)
    const { result } = await server.inject({
      method: 'GET',
      url: '/gear-selection',
      headers: { cookie: favouriteCookie }
    })
    const $ = load(result)

    expect($('a.govuk-link[href="/add-gear"]').text()).toBe('Add gear')
    expect($('a.govuk-link[href="/remove-gear"]').text()).toBe('Remove gear')
  })

  test('Should hide Remove gear when there are no favourite gears', async () => {
    const favouriteCookie = await seedFavouriteGears(server)
    const removeResponse = await server.inject({
      method: 'POST',
      url: '/remove-gear',
      headers: { cookie: favouriteCookie },
      payload: {
        gearIds: [
          'beam-trawl',
          'bottom-otter-trawl',
          'dredge',
          'handlines-pole-lines',
          'miscellaneous-gear-diving',
          'pots',
          'seine-nets',
          'trammel-net',
          'traps'
        ]
      }
    })
    const cookie =
      removeResponse.headers['set-cookie']?.[0].split(';')[0] || favouriteCookie

    const { result } = await server.inject({
      method: 'GET',
      url: '/gear-selection',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('a.govuk-link[href="/add-gear"]')).toHaveLength(1)
    expect($('a.govuk-link[href="/remove-gear"]')).toHaveLength(0)
  })

  test('Should restore previously-selected gear ids as checked', async () => {
    const favouriteCookie = await seedFavouriteGears(server)
    const setResponse = await server.inject({
      method: 'POST',
      url: '/gear-selection',
      headers: { cookie: favouriteCookie },
      payload: { gearIds: ['dredge', 'traps'] }
    })
    const cookie =
      setResponse.headers['set-cookie']?.[0].split(';')[0] || favouriteCookie

    const { result } = await server.inject({
      method: 'GET',
      url: '/gear-selection',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('input[value="dredge"]').prop('checked')).toBe(true)
    expect($('input[value="traps"]').prop('checked')).toBe(true)
    expect($('input[value="pots"]').prop('checked')).toBe(false)
  })

  test('Should pre-fill pots fields when pots was previously selected', async () => {
    const favouriteCookie = await seedFavouriteGears(server)
    const setResponse = await server.inject({
      method: 'POST',
      url: '/gear-selection',
      headers: { cookie: favouriteCookie },
      payload: { gearIds: 'pots', potsHauled: '45', potsInWater: '12' }
    })
    const cookie =
      setResponse.headers['set-cookie']?.[0].split(';')[0] || favouriteCookie

    const { result } = await server.inject({
      method: 'GET',
      url: '/gear-selection',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('input[value="pots"]').prop('checked')).toBe(true)
    expect($('#potsHauled').attr('value')).toBe('45')
    expect($('#potsInWater').attr('value')).toBe('12')
  })

  test('A GET to the removed pots-details route should 404', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/pots-details'
    })

    expect(statusCode).toBe(statusCodes.notFound)
  })

  test('Should not tick any gear until the user selects one', async () => {
    const favouriteCookie = await seedFavouriteGears(server)
    const { result } = await server.inject({
      method: 'GET',
      url: '/gear-selection',
      headers: { cookie: favouriteCookie }
    })
    const $ = load(result)

    expect($('input[name="gearIds"]').length).toBeGreaterThan(0)
    expect($('input[name="gearIds"][checked]').length).toBe(0)
  })
})

describe('#gearSelectionSubmitController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should re-render the page with an error summary when nothing is selected', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/gear-selection',
      payload: {}
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary')).toHaveLength(1)
    expect($('.govuk-error-summary').text()).toContain(
      'Select the gear used on this trip'
    )
    expect($('.govuk-error-summary a').attr('href')).toBe('#gearIds')
    expect($('.govuk-error-message')).toHaveLength(1)
  })

  test('Should re-render the page with an error summary for an unknown gear id', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/gear-selection',
      payload: { gearIds: 'nets' }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary')).toHaveLength(1)
  })

  test('Should redirect to statistical area on a valid non-pots selection', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/gear-selection',
      payload: { gearIds: 'dredge' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/statistical-area?gearId=dredge')
  })

  test.each([
    [{ gearIds: 'dredge' }, 'dredge'],
    [{ gearIds: 'seine-nets' }, 'seine nets (not specified)'],
    [{ gearIds: 'pots', potsHauled: '10', potsInWater: '2' }, 'pots']
  ])(
    'Should carry selected gear content into the Other page for %s',
    async (payload, gearName) => {
      const response = await server.inject({
        method: 'POST',
        url: '/gear-selection',
        payload
      })
      expect(response.statusCode).toBe(statusCodes.seeOther)
      const cookie = response.headers['set-cookie'][0].split(';')[0]
      const expectedHeading = `Select the statistical sub area where the majority of your catch was caught using ${gearName}`

      for (const method of ['GET', 'POST']) {
        const { result, statusCode } = await server.inject({
          method,
          url: '/statistical-area-other',
          headers: { cookie },
          ...(method === 'POST' && { payload: {} })
        })
        expect(statusCode).toBe(
          method === 'GET' ? statusCodes.ok : statusCodes.badRequest
        )
        expect(load(result)('h1').text().trim()).toBe(expectedHeading)
      }
    }
  )

  test('Should collect catch answers for a newly selected gear even when a return query is supplied', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/gear-selection?return=/check-answers',
      payload: { gearIds: 'dredge' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/statistical-area?gearId=dredge')
  })

  test('Should save the selected gear ids and leave pots details absent for a non-pots selection', async () => {
    const favouriteCookie = await seedFavouriteGears(server)
    const setResponse = await server.inject({
      method: 'POST',
      url: '/gear-selection',
      headers: { cookie: favouriteCookie },
      payload: { gearIds: 'dredge' }
    })
    const cookie =
      setResponse.headers['set-cookie']?.[0].split(';')[0] || favouriteCookie

    const { result } = await server.inject({
      method: 'GET',
      url: '/gear-selection',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('input[value="dredge"]').prop('checked')).toBe(true)
    expect($('#potsHauled').attr('value')).toBeUndefined()
    expect($('#potsInWater').attr('value')).toBeUndefined()
  })

  test('Should redirect to statistical area when pots is selected with valid pots details', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/gear-selection',
      payload: { gearIds: 'pots', potsHauled: '45', potsInWater: '12' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/statistical-area?gearId=pots')
  })

  test('Should save pots details matching the submitted numbers', async () => {
    const favouriteCookie = await seedFavouriteGears(server)
    const setResponse = await server.inject({
      method: 'POST',
      url: '/gear-selection',
      headers: { cookie: favouriteCookie },
      payload: { gearIds: 'pots', potsHauled: '30', potsInWater: '7' }
    })
    const cookie =
      setResponse.headers['set-cookie']?.[0].split(';')[0] || favouriteCookie

    const { result } = await server.inject({
      method: 'GET',
      url: '/gear-selection',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('#potsHauled').attr('value')).toBe('30')
    expect($('#potsInWater').attr('value')).toBe('7')
  })

  test('Should re-render with both field errors when pots is selected but both fields are missing', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/gear-selection',
      payload: { gearIds: 'pots' }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary').text()).toContain(
      'Enter the total number of pots or traps hauled'
    )
    expect($('.govuk-error-summary').text()).toContain(
      'Enter the total number of pots or traps left in the water'
    )
    expect($('.govuk-error-summary a[href="#potsHauled"]')).toHaveLength(1)
    expect($('.govuk-error-summary a[href="#potsInWater"]')).toHaveLength(1)
  })

  test('Should re-render with a single field error when only one pots field is missing', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/gear-selection',
      payload: { gearIds: 'pots', potsHauled: '10' }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary').text()).not.toContain(
      'Enter the total number of pots or traps hauled'
    )
    expect($('.govuk-error-summary').text()).toContain(
      'Enter the total number of pots or traps left in the water'
    )
  })

  test('Should re-render with a field error when a pots field is negative', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/gear-selection',
      payload: { gearIds: 'pots', potsHauled: '-1', potsInWater: '5' }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary').text()).toContain(
      'Total pots or traps hauled must be a whole number greater than 0'
    )
  })

  test('Should re-render with field errors when pots fields are 0', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/gear-selection',
      payload: { gearIds: 'pots', potsHauled: '0', potsInWater: '0' }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary').text()).toContain(
      'Total pots or traps hauled must be a whole number greater than 0'
    )
    expect($('.govuk-error-summary').text()).toContain(
      'Total pots or traps left in the water must be a whole number greater than 0'
    )
  })

  test('Should re-render with a field error when a pots field is not a whole number', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/gear-selection',
      payload: { gearIds: 'pots', potsHauled: '5.5', potsInWater: '5' }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary').text()).toContain(
      'Total pots or traps hauled must be a whole number greater than 0'
    )
  })

  test('Should leave unrelated journey state unaffected by a gear-selection submission', async () => {
    const departureResponse = await server.inject({
      method: 'POST',
      url: '/departure-port',
      payload: { departurePort: 'hastings' }
    })
    let cookie = departureResponse.headers['set-cookie'][0].split(';')[0]

    const returnPortResponse = await server.inject({
      method: 'POST',
      url: '/return-port',
      payload: { returnPort: 'newhaven' },
      headers: { cookie }
    })
    cookie = returnPortResponse.headers['set-cookie'][0].split(';')[0]

    const gearResponse = await server.inject({
      method: 'POST',
      url: '/gear-selection',
      payload: { gearIds: 'dredge' },
      headers: { cookie }
    })
    cookie = gearResponse.headers['set-cookie'][0].split(';')[0]

    const departureCheck = await server.inject({
      method: 'GET',
      url: '/departure-port',
      headers: { cookie }
    })
    const returnCheck = await server.inject({
      method: 'GET',
      url: '/return-port',
      headers: { cookie }
    })

    expect(
      load(departureCheck.result)('input[value="hastings"]').prop('checked')
    ).toBe(true)
    expect(
      load(returnCheck.result)('input[value="newhaven"]').prop('checked')
    ).toBe(true)
  })

  test('Should save and pre-fill measurements for a non-pots gear type', async () => {
    const favouriteCookie = await seedFavouriteGears(server)
    const setResponse = await server.inject({
      method: 'POST',
      url: '/gear-selection',
      headers: { cookie: favouriteCookie },
      payload: {
        gearIds: 'dredge',
        'dredge-numberOfDredges': '2',
        'dredge-numberOfTimesShot': '3'
      }
    })
    const cookie =
      setResponse.headers['set-cookie']?.[0].split(';')[0] || favouriteCookie

    const { result } = await server.inject({
      method: 'GET',
      url: '/gear-selection',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('#dredge-numberOfDredges').attr('value')).toBe('2')
    expect($('#dredge-numberOfTimesShot').attr('value')).toBe('3')
  })

  test('Should keep saved pots measurements when another gear is submitted without pots', async () => {
    const favouriteCookie = await seedFavouriteGears(server)
    const potsResponse = await server.inject({
      method: 'POST',
      url: '/gear-selection',
      headers: { cookie: favouriteCookie },
      payload: { gearIds: 'pots', potsHauled: '45', potsInWater: '12' }
    })
    let cookie =
      potsResponse.headers['set-cookie']?.[0].split(';')[0] || favouriteCookie

    const dredgeResponse = await server.inject({
      method: 'POST',
      url: '/gear-selection',
      payload: { gearIds: 'dredge' },
      headers: { cookie }
    })
    cookie = dredgeResponse.headers['set-cookie']?.[0].split(';')[0] || cookie

    const { result } = await server.inject({
      method: 'GET',
      url: '/gear-selection',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('input[value="pots"]').prop('checked')).toBe(false)
    expect($('#potsHauled').attr('value')).toBe('45')
    expect($('#potsInWater').attr('value')).toBe('12')
  })

  test('Should retain unticked gear measurements and continue the per-gear flow when reselected', async () => {
    let cookie = await seedFavouriteGears(server)
    for (const [payload, expectedPath] of [
      [
        {
          gearIds: ['pots', 'dredge'],
          potsHauled: '45',
          potsInWater: '12',
          'dredge-numberOfDredges': '2',
          'dredge-numberOfTimesShot': '3'
        },
        '/statistical-area?gearId=pots'
      ],
      [{ gearIds: 'beam-trawl' }, '/statistical-area?gearId=beam-trawl']
    ]) {
      const response = await server.inject({
        method: 'POST',
        url: '/gear-selection',
        payload,
        headers: { cookie }
      })
      expect(response.statusCode).toBe(statusCodes.seeOther)
      expect(response.headers.location).toBe(expectedPath)
      cookie = response.headers['set-cookie']?.[0]?.split(';')[0] || cookie
    }

    const saved = await server.inject({
      method: 'GET',
      url: '/gear-selection',
      headers: { cookie }
    })
    const $saved = load(saved.result)
    expect($saved('input[value="pots"]').prop('checked')).toBe(false)
    expect($saved('input[value="dredge"]').prop('checked')).toBe(false)
    expect($saved('#potsHauled').attr('value')).toBe('45')
    expect($saved('#potsInWater').attr('value')).toBe('12')
    expect($saved('#dredge-numberOfDredges').attr('value')).toBe('2')
    expect($saved('#dredge-numberOfTimesShot').attr('value')).toBe('3')
    cookie = saved.headers['set-cookie']?.[0]?.split(';')[0] || cookie

    const reselected = await server.inject({
      method: 'POST',
      url: '/gear-selection',
      headers: { cookie },
      payload: {
        gearIds: 'dredge',
        'dredge-numberOfDredges': '4',
        'dredge-numberOfTimesShot': '5'
      }
    })
    expect(reselected.statusCode).toBe(statusCodes.seeOther)
    expect(reselected.headers.location).toBe('/statistical-area?gearId=dredge')
    cookie = reselected.headers['set-cookie']?.[0]?.split(';')[0] || cookie

    const updated = await server.inject({
      method: 'GET',
      url: '/gear-selection',
      headers: { cookie }
    })
    const $updated = load(updated.result)
    expect($updated('input[value="dredge"]').prop('checked')).toBe(true)
    expect($updated('#dredge-numberOfDredges').attr('value')).toBe('4')
    expect($updated('#dredge-numberOfTimesShot').attr('value')).toBe('5')
    expect($updated('#potsHauled').attr('value')).toBe('45')
  })

  test('Should re-render with a field error when a non-pots measurement is invalid', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/gear-selection',
      payload: {
        gearIds: 'dredge',
        'dredge-numberOfDredges': '-1'
      }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary').text()).toContain(
      'Number of dredges must be a whole number greater than 0'
    )
    expect(
      $('.govuk-error-summary a[href="#dredge-numberOfDredges"]')
    ).toHaveLength(1)
  })

  test('Should re-render with field errors when non-pots measurements are 0', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/gear-selection',
      payload: {
        gearIds: 'dredge',
        'dredge-numberOfDredges': '0',
        'dredge-numberOfTimesShot': '0'
      }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary').text()).toContain(
      'Number of dredges must be a whole number greater than 0'
    )
    expect($('.govuk-error-summary').text()).toContain(
      'Enter a number greater than 0'
    )
  })

  test('Should allow a non-pots gear type to be saved with its measurement fields left blank', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/gear-selection',
      payload: { gearIds: 'dredge' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/statistical-area?gearId=dredge')
  })
})
