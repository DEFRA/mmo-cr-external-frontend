import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#selectVesselController', () => {
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
      url: '/select-vessel'
    })

    expect(result).toEqual(expect.stringContaining('Select a vessel |'))
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should render the vessel name', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/select-vessel'
    })
    const $ = load(result)

    expect($('.govuk-body').text()).toContain('OLGA')
  })
})

describe('#selectVesselSubmitController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should redirect to the trip date question', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/select-vessel'
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/trip-date')
  })
})
