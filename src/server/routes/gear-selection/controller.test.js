import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

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

  test('Should render 9 gear checkboxes with the stable ids', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/gear-selection'
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
    const { result } = await server.inject({
      method: 'GET',
      url: '/gear-selection'
    })
    const $ = load(result)

    expect($('#potsHauled')).toHaveLength(1)
    expect($('#potsInWater')).toHaveLength(1)
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

  test('Should restore previously-selected gear ids as checked', async () => {
    const setResponse = await server.inject({
      method: 'POST',
      url: '/gear-selection',
      payload: { gearIds: ['dredge', 'traps'] }
    })
    const cookie = setResponse.headers['set-cookie'][0].split(';')[0]

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
    const setResponse = await server.inject({
      method: 'POST',
      url: '/gear-selection',
      payload: { gearIds: 'pots', potsHauled: '45', potsInWater: '12' }
    })
    const cookie = setResponse.headers['set-cookie'][0].split(';')[0]

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
      'Select the gear you used'
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
    expect(headers.location).toBe('/statistical-area')
  })

  test('Should save the selected gear ids and leave pots details absent for a non-pots selection', async () => {
    const setResponse = await server.inject({
      method: 'POST',
      url: '/gear-selection',
      payload: { gearIds: 'dredge' }
    })
    const cookie = setResponse.headers['set-cookie'][0].split(';')[0]

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
    expect(headers.location).toBe('/statistical-area')
  })

  test('Should save pots details matching the submitted numbers', async () => {
    const setResponse = await server.inject({
      method: 'POST',
      url: '/gear-selection',
      payload: { gearIds: 'pots', potsHauled: '30', potsInWater: '7' }
    })
    const cookie = setResponse.headers['set-cookie'][0].split(';')[0]

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
      'Enter the total pots or traps hauled'
    )
    expect($('.govuk-error-summary').text()).toContain(
      'Enter the total pots or traps left in the water'
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
      'Enter the total pots or traps hauled'
    )
    expect($('.govuk-error-summary').text()).toContain(
      'Enter the total pots or traps left in the water'
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
      'Enter the total pots or traps hauled'
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
      'Enter the total pots or traps hauled'
    )
  })

  test('Should clear pots details when a previous pots selection is replaced without pots', async () => {
    const potsResponse = await server.inject({
      method: 'POST',
      url: '/gear-selection',
      payload: { gearIds: 'pots', potsHauled: '45', potsInWater: '12' }
    })
    let cookie = potsResponse.headers['set-cookie'][0].split(';')[0]

    const dredgeResponse = await server.inject({
      method: 'POST',
      url: '/gear-selection',
      payload: { gearIds: 'dredge' },
      headers: { cookie }
    })
    cookie = dredgeResponse.headers['set-cookie'][0].split(';')[0]

    const { result } = await server.inject({
      method: 'GET',
      url: '/gear-selection',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('input[value="pots"]').prop('checked')).toBe(false)
    expect($('#potsHauled').attr('value')).toBeUndefined()
    expect($('#potsInWater').attr('value')).toBeUndefined()
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
})
